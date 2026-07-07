// LLM Health Score Explainer — generates plain-language explanations for user.
// CRITICAL POLICY CONSTRAINTS (enforced in this module):
//   1. LLM output is EXPLANATION ONLY — it cannot modify any score, nutrition, or ingredient field.
//   2. All numeric values shown to users come from the computed HealthScoreResult, not LLM output.
//   3. The system prompt explicitly forbids diagnosis and treatment language (output-policy rule).
//   4. LLM explanation is stripped of any numeric overrides before rendering.

import type { GatewayRouter } from '../gateway/router.js';
import type { HealthScoreResult } from '../engines/score/engine.js';

export interface ExplainRequest {
  traceId: string;
  productName: string;
  score: HealthScoreResult;
  language?: 'en' | 'hi';  // hi = Hindi (Phase 10)
}

export interface ExplainResult {
  headline: string;    // 1-sentence summary (sourced from LLM)
  bullets: string[];   // 3–5 plain-language bullets (LLM)
  disclaimer: string;  // static, never LLM
}

const SYSTEM_PROMPT = `You are a food literacy assistant for NutriMind, an Indian nutrition app.
Your role is to EXPLAIN health scores in plain language. You are strictly prohibited from:
- Providing medical advice, diagnoses, or treatment recommendations
- Suggesting the product will cure, prevent, or treat any disease
- Modifying any numerical values — all numbers are computed by a certified algorithm, not you
- Making specific claims about quantities ("eat X grams per day")

Respond in this exact JSON format (no markdown fences):
{
  "headline": "one sentence summary of why this product scored as it did",
  "bullets": ["3 to 5 short bullets — positive aspects first, then areas to be mindful of"]
}

Tone: warm, honest, non-alarmist. Use Indian food context where relevant (dal, roti, rice, ghee etc.).
Audience: general public, not medical professionals. Keep language at 8th-grade reading level.`;

export async function explainHealthScore(
  req: ExplainRequest,
  gateway: GatewayRouter,
): Promise<ExplainResult> {
  const { score, productName, traceId, language = 'en' } = req;

  const prompt = buildUserPrompt(productName, score, language);

  const raw = await gateway.complete({
    tier: 'parse_assist',  // low-cost tier; no vision needed
    messages: [{ role: 'user', content: prompt }],
    systemPrompt: SYSTEM_PROMPT,
    traceId,
    maxTokens: 512,
    temperature: 0.3,
  });

  return parseExplainerResponse(raw.content);
}

function buildUserPrompt(
  productName: string,
  score: HealthScoreResult,
  _language: string,
): string {
  const { subscores } = score;
  return [
    `Product: ${productName}`,
    `Overall health score: ${score.score}/100 (${score.band})`,
    '',
    'Sub-score details (use these for your explanation — do not invent new numbers):',
    `  Sodium: ${subscores.sodium.score}/100 (${subscores.sodium.level}) — ${subscores.sodium.sodiumMg} mg/100g`,
    `  Sugar: ${subscores.sugar.score}/100 (${subscores.sugar.level}) — ${subscores.sugar.sugarG.toFixed(1)} g/100g${subscores.sugar.isEstimated ? ' [estimated from total sugars]' : ''}`,
    `  Saturated fat: ${subscores.satFat.score}/100 (${subscores.satFat.level}) — ${subscores.satFat.satFatG.toFixed(1)} g/100g`,
    `  Trans fat: ${subscores.transFat.score}/100 (${subscores.transFat.level}) — ${subscores.transFat.transFatG.toFixed(2)} g/100g`,
    `  Dietary fibre: ${subscores.fibre.score}/100 (${subscores.fibre.level}) — ${subscores.fibre.fibreG.toFixed(1)} g/100g`,
    `  Protein: ${subscores.protein.score}/100 (${subscores.protein.level}) — ${subscores.protein.proteinG.toFixed(1)} g/100g`,
    `  NOVA group: ${subscores.nova.group} (${subscores.nova.confidence} confidence) — ${subscores.nova.reason}`,
    '',
    'Explain this score to an Indian consumer. Focus on the 2–3 factors that most affected the score.',
  ].join('\n');
}

function parseExplainerResponse(content: string): ExplainResult {
  // Strip markdown fences if present
  const stripped = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  let headline = 'This product received this score based on its nutritional profile.';
  let bullets: string[] = [];

  try {
    const parsed = JSON.parse(stripped) as { headline?: unknown; bullets?: unknown };

    if (typeof parsed.headline === 'string' && parsed.headline.trim()) {
      headline = sanitiseText(parsed.headline.trim());
    }

    if (Array.isArray(parsed.bullets)) {
      bullets = (parsed.bullets as unknown[])
        .filter((b): b is string => typeof b === 'string' && b.trim().length > 0)
        .map((b) => sanitiseText(b.trim()))
        .slice(0, 5);
    }
  } catch {
    // LLM returned non-JSON; fall back to extracting lines
    bullets = stripped
      .split('\n')
      .filter((l) => l.trim().startsWith('-') || l.trim().startsWith('•'))
      .map((l) => sanitiseText(l.replace(/^[-•]\s*/, '').trim()))
      .slice(0, 5);
  }

  return {
    headline,
    bullets,
    disclaimer:
      'This score is for general information only and does not constitute medical advice. ' +
      'Consult a registered dietitian for personalised nutrition guidance.',
  };
}

// Strip any text that contains numeric override patterns ("score is X", "change value to Y")
// This is a defence-in-depth measure — the real safety comes from the system prompt.
function sanitiseText(text: string): string {
  // Remove anything that looks like an attempt to override a numeric field
  return text
    .replace(/score\s+(is|should be|becomes?)\s+\d+/gi, '[score — see above]')
    .replace(/change\s+(the\s+)?score\s+to\s+\d+/gi, '[not permitted]');
}
