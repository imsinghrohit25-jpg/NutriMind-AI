// Voice NLU — parse Hinglish/Hindi/English food-logging utterances.
// Converts transcribed speech to structured meal-log intents.
// Uses parse_assist tier LLM for intent extraction.

import type { GatewayRouter } from '../gateway/router.js';
import type { SupportedLocale } from '../i18n/language.js';

export type VoiceIntent =
  | 'log_meal'
  | 'query_score'
  | 'query_nutrients'
  | 'set_portion'
  | 'ask_alternative'
  | 'unknown';

export interface ParsedFood {
  name:     string;    // canonical food name (English)
  nameRaw:  string;    // as spoken
  quantity?: number;
  unit?:    string;    // 'g' | 'ml' | 'cup' | 'piece' | 'katori' | 'roti' | etc.
}

export interface NLUResult {
  intent:   VoiceIntent;
  foods:    ParsedFood[];
  mealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  rawText:  string;
  confidence: number;
  locale:   SupportedLocale;
}

// Hinglish quantity words → numeric mappings
const HINGLISH_QUANTITY_MAP: Record<string, number> = {
  'ek':     1,  'do':    2,  'teen':  3,   'char':   4,
  'paanch': 5,  'chha':  6,  'saat':  7,   'aath':   8,
  'nau':    9,  'das':   10, 'adha':  0.5, 'aadha':  0.5,
  'dedh':   1.5,'dhai':  2.5,'pav':   0.25,
  'quarter':0.25,'half': 0.5,'one':   1,   'two':    2,
  'three':  3,  'four':  4,  'five':  5,
};

// Common portion unit aliases (Hinglish)
const UNIT_ALIASES: Record<string, string> = {
  'katori':  'katori',
  'katora':  'katori',
  'bowl':    'bowl',
  'roti':    'roti',
  'chapati': 'roti',
  'phulka':  'roti',
  'paratha': 'paratha',
  'glass':   'glass',
  'gilas':   'glass',
  'cup':     'cup',
  'plate':   'plate',
  'thali':   'plate',
  'piece':   'piece',
  'slice':   'slice',
  'tikki':   'piece',
  'ladoo':   'piece',
  'laddoo':  'piece',
};

function resolveQuantity(raw: string): number {
  const lower = raw.toLowerCase().trim();
  if (HINGLISH_QUANTITY_MAP[lower] !== undefined) {
    return HINGLISH_QUANTITY_MAP[lower]!;
  }
  const n = parseFloat(raw);
  return isNaN(n) ? 1 : n;
}

function resolveUnit(raw: string): string {
  return UNIT_ALIASES[raw.toLowerCase().trim()] ?? raw.toLowerCase().trim();
}

const MEAL_TYPE_PATTERNS: Array<[RegExp, NLUResult['mealType']]> = [
  [/breakfast|nashta|naashta|subah\s*ka/i, 'breakfast'],
  [/lunch|dopahar|dopehr|dupahar/i,         'lunch'],
  [/dinner|raat\s*ka|khana\s*raat|rat\s*ka/i,'dinner'],
  [/snack|chai\s*time|shaam|evening/i,       'snack'],
];

function detectMealType(text: string): NLUResult['mealType'] | undefined {
  for (const [pattern, type] of MEAL_TYPE_PATTERNS) {
    if (pattern.test(text)) return type;
  }
  return undefined;
}

const SYSTEM_PROMPT = `You are a food logging assistant. Extract structured food intake from the user's speech.

Return ONLY valid JSON in this exact shape:
{
  "intent": "log_meal" | "query_score" | "query_nutrients" | "set_portion" | "ask_alternative" | "unknown",
  "foods": [
    { "name": "<English food name>", "nameRaw": "<as spoken>", "quantity": <number|null>, "unit": "<unit|null>" }
  ],
  "mealType": "breakfast" | "lunch" | "dinner" | "snack" | null,
  "confidence": <0.0-1.0>
}

Rules:
- Translate Hinglish/Hindi food names to standard English (e.g. "dal chawal" → "lentils and rice")
- Keep nameRaw as spoken
- If quantity is not specified, omit it
- Common units: roti, katori, bowl, glass, cup, plate, piece, g, ml
- If intent is not food logging or nutrition query, set intent to "unknown"`;

/** Parse a transcribed utterance → structured NLU result. */
export async function parseVoiceUtterance(opts: {
  text:    string;
  locale:  SupportedLocale;
  gateway: GatewayRouter;
}): Promise<NLUResult> {
  const { text, locale, gateway } = opts;

  const mealType = detectMealType(text);

  try {
    const response = await gateway.complete({
      tier:         'parse_assist',
      systemPrompt: SYSTEM_PROMPT,
      messages:     [{ role: 'user', content: `Locale: ${locale}\nSpeech: "${text}"` }],
      maxTokens:    400,
      traceId:      'voice-nlu',
    });

    const jsonMatch = /\{[\s\S]*\}/.exec(response.content);
    if (!jsonMatch) throw new Error('No JSON in response');

    const parsed = JSON.parse(jsonMatch[0]) as {
      intent:    VoiceIntent;
      foods:     Array<{ name: string; nameRaw: string; quantity?: number; unit?: string }>;
      mealType?: NLUResult['mealType'];
      confidence: number;
    };

    return {
      intent:     parsed.intent ?? 'unknown',
      foods:      (parsed.foods ?? []).map((f) => ({
        name:     f.name,
        nameRaw:  f.nameRaw,
        quantity: f.quantity,
        unit:     f.unit ? resolveUnit(f.unit) : undefined,
      })),
      mealType:   mealType ?? parsed.mealType,
      rawText:    text,
      confidence: parsed.confidence ?? 0.5,
      locale,
    };
  } catch {
    return {
      intent:    'unknown',
      foods:     [],
      mealType,
      rawText:   text,
      confidence:0,
      locale,
    };
  }
}

/** Resolve spoken quantity strings to numeric values (exported for tests). */
export { resolveQuantity, resolveUnit };
