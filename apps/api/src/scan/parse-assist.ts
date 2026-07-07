// parse-assist — calls the AI gateway for disambiguation ONLY.
// Purpose: help parse ambiguous OCR values where regex patterns failed.
// Policy: LLM is NEVER allowed to set nutrition values directly;
//         it returns structured hints that the parser validates and applies.
// This is classification/disambiguation, not nutritional data generation.

import type { GatewayRouter } from '../gateway/router.js';
import type { FieldResult, ConfidenceLevel } from './label-parser/parser.js';

export interface ParseAssistRequest {
  rawText: string;
  // Fields that failed regex extraction
  missingFields: string[];
  // Full OCR context for the LLM to analyse
  labelContext: string;
}

export interface ParseAssistHint {
  field: string;
  value: number | null;
  unit: string;
  confidence: ConfidenceLevel;
  reasoning: string;
}

export interface ParseAssistResult {
  hints: ParseAssistHint[];
  productNameGuess: string | null;
  brandGuess: string | null;
}

const PARSE_ASSIST_SYSTEM = `You are a nutrition label parser assistant for Indian food products.
Your ONLY job is to extract specific numerical values from raw OCR text.
You MUST NOT infer, estimate, or guess nutrition values that are not explicitly present in the text.
Return ONLY values that you can directly point to in the provided text.
If a value is not present in the text, return null for that field.
Return ONLY valid JSON, no markdown code blocks.`;

export async function parseAssist(
  req: ParseAssistRequest,
  gateway: GatewayRouter,
): Promise<ParseAssistResult> {
  const userPrompt = `
Raw OCR text from nutrition label:
---
${req.labelContext.slice(0, 3000)}
---

Extract the following fields (only if present in the text above):
${req.missingFields.map((f) => `- ${f}`).join('\n')}

Return JSON in this exact format:
{
  "hints": [
    {
      "field": "fieldName",
      "value": 123.4,
      "unit": "g",
      "confidence": "high",
      "reasoning": "found at line ..."
    }
  ],
  "productName": "product name or null",
  "brand": "brand name or null"
}

For each field: set value to null if NOT found in the text. confidence must be "high", "medium", or "low".
`;

  const response = await gateway.complete({
    tier: 'parse_assist',
    messages: [
      { role: 'user', content: userPrompt },
    ],
    systemPrompt: PARSE_ASSIST_SYSTEM,
    traceId: crypto.randomUUID(),
    maxTokens: 1000,
    temperature: 0,
  });

  let parsed: {
    hints: Array<{
      field: string;
      value: number | null;
      unit: string;
      confidence: string;
      reasoning: string;
    }>;
    productName: string | null;
    brand: string | null;
  };

  try {
    const raw = response.content
      .replace(/^```(?:json)?\n?/i, '')
      .replace(/\n?```$/i, '')
      .trim();
    parsed = JSON.parse(raw) as typeof parsed;
  } catch {
    return { hints: [], productNameGuess: null, brandGuess: null };
  }

  // Validate: only pass through values that are numbers, not invented strings
  const validHints: ParseAssistHint[] = (parsed.hints ?? [])
    .filter((h) => req.missingFields.includes(h.field))
    .filter((h) => h.value === null || (typeof h.value === 'number' && isFinite(h.value)))
    .map((h) => ({
      field: h.field,
      value: h.value,
      unit: h.unit ?? '',
      confidence: ((['high', 'medium', 'low'] as string[]).includes(h.confidence)
        ? (h.confidence as 'high' | 'medium' | 'low')
        : 'low') satisfies ConfidenceLevel,
      reasoning: h.reasoning ?? '',
    }));

  return {
    hints: validHints,
    productNameGuess: typeof parsed.productName === 'string' ? parsed.productName : null,
    brandGuess: typeof parsed.brand === 'string' ? parsed.brand : null,
  };
}

// Merges parse-assist hints back into field results.
// LLM values always get 'medium' max confidence (lower than direct regex).
export function mergeAssistHints(
  extracted: Record<string, FieldResult>,
  hints: ParseAssistHint[],
): Record<string, FieldResult> {
  const merged = { ...extracted };
  for (const hint of hints) {
    const current = merged[hint.field];
    // Only apply hint if field was absent or low-confidence
    if (
      !current ||
      current.confidence === 'absent' ||
      current.confidence === 'low'
    ) {
      merged[hint.field] = {
        value: hint.value,
        confidence: hint.confidence === 'high' ? 'medium' : hint.confidence,
        rawMatch: `[assist: ${hint.reasoning.slice(0, 80)}]`,
      };
    }
  }
  return merged;
}
