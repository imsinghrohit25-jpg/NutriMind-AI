// Cloud OCR fallback — Phase 6 (`global.p6.cloud_ocr_fallback`).
// Reuses the existing multimodal gateway (`vision_analysis` tier, already used by
// `meal-photo/vision.ts`) rather than integrating a new, separate external Vision API —
// this project already routes multimodal understanding through GatewayRouter across real
// providers (OpenAI/Anthropic/Gemini), so this is the same proven infrastructure, not an
// unproven new dependency. Used when on-device ML Kit OCR can't handle the label's script
// (see script-detector.ts) — e.g. Arabic, Tamil, Telugu packaging.
//
// Output is always a suggestion, not ground truth: `nutrition.source` is set to
// 'cloud_ocr_llm' and confidence is capped below what a clean deterministic regex match on
// legible on-device OCR text would earn, so downstream consumers (e.g. the allergen fail-safe)
// treat it with appropriately reduced trust — consistent with the LLM policy used throughout
// this project (LLM identifies/extracts; never becomes the sole unflagged source of truth for
// a safety-relevant field).

import type { GatewayRouter } from '../../gateway/router.js';
import type { NutritionPer100g } from '../../nutrition/canonical-model.js';
import { fillEnergyFields } from '../../nutrition/derived.js';
import type { ParsedLabel, ConfidenceLevel } from './parser.js';

const CLOUD_OCR_SYSTEM_PROMPT = `You are a nutrition label OCR and extraction assistant.
The attached image shows a packaged food nutrition label, possibly in a script other than
Latin or Devanagari. Read the label and extract per-100g (or per-serving, if that's all that
is shown) nutrition values.

Return ONLY valid JSON in this exact shape:
{
  "energyKcal": <number|null>,
  "proteinG": <number|null>,
  "fatTotalG": <number|null>,
  "fatSaturatedG": <number|null>,
  "fatTransG": <number|null>,
  "carbohydratesG": <number|null>,
  "sugarsG": <number|null>,
  "fibreG": <number|null>,
  "sodiumMg": <number|null>,
  "servingSizeG": <number|null>,
  "isPerServing": <true|false>,
  "confidence": <0.0-1.0>
}

Rules:
- Use null for any value you cannot read clearly — never guess a plausible-looking number.
- confidence reflects how legible and complete the label was, not how confident you are in
  your reading ability in general.
- If the image does not contain a nutrition label at all, return all values null and
  confidence 0.`;

const CLOUD_OCR_MAX_CONFIDENCE = 0.6; // capped below a clean on-device regex match (can reach 1.0)

interface CloudOcrRaw {
  energyKcal?: number | null;
  proteinG?: number | null;
  fatTotalG?: number | null;
  fatSaturatedG?: number | null;
  fatTransG?: number | null;
  carbohydratesG?: number | null;
  sugarsG?: number | null;
  fibreG?: number | null;
  sodiumMg?: number | null;
  servingSizeG?: number | null;
  isPerServing?: boolean;
  confidence?: number;
}

/** Extract a nutrition label from an image via the gateway's vision_analysis tier. */
export async function extractLabelViaCloudVision(opts: {
  imageBase64: string;
  imageMediaType: 'image/jpeg' | 'image/png' | 'image/webp';
  gateway: GatewayRouter;
  traceId: string;
}): Promise<ParsedLabel> {
  const { imageBase64, imageMediaType, gateway, traceId } = opts;

  let raw: CloudOcrRaw = {};
  try {
    const response = await gateway.complete({
      tier: 'vision_analysis',
      messages: [
        { role: 'user', content: 'Extract the nutrition label values from this image. Return valid JSON only.' },
      ],
      systemPrompt: CLOUD_OCR_SYSTEM_PROMPT,
      images: [{ mimeType: imageMediaType, data: imageBase64 }],
      traceId,
      maxTokens: 500,
      temperature: 0,
    });

    const text = response.content.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
    raw = JSON.parse(text) as CloudOcrRaw;
  } catch {
    raw = {};
  }

  const cappedConfidence = Math.min(CLOUD_OCR_MAX_CONFIDENCE, Math.max(0, raw.confidence ?? 0));

  const nutrition: Partial<NutritionPer100g> = {
    source: 'cloud_ocr_llm',
    sourceId: '',
    datasetVersion: 'cloud_ocr_v1',
    retrievedAt: new Date(),
    licenseClass: 'user_submitted',
    energyKcal:    raw.energyKcal ?? null,
    proteinG:      raw.proteinG ?? null,
    fatTotalG:     raw.fatTotalG ?? null,
    fatSaturatedG: raw.fatSaturatedG ?? null,
    fatTransG:     raw.fatTransG ?? null,
    carbohydratesG: raw.carbohydratesG ?? null,
    sugarsG:       raw.sugarsG ?? null,
    dietaryFiberG: raw.fibreG ?? null,
    sodiumMg:      raw.sodiumMg ?? null,
    confidence:    cappedConfidence,
    notes:         'Extracted via cloud OCR fallback (unsupported script) — treat as a suggestion, not ground truth.',
  };
  fillEnergyFields(nutrition as NutritionPer100g);

  const fieldLevel: ConfidenceLevel = cappedConfidence >= 0.4 ? 'medium' : 'low';
  const fieldNames = [
    'energyKcal', 'proteinG', 'fatTotalG', 'fatSaturatedG', 'fatTransG',
    'carbohydratesG', 'sugarsG', 'fibreG', 'sodiumMg',
  ];
  const fieldConfidence: Record<string, ConfidenceLevel> = {};
  const lowConfidenceFields: string[] = [];
  for (const f of fieldNames) {
    const key = f as keyof CloudOcrRaw;
    if (raw[key] === null || raw[key] === undefined) {
      fieldConfidence[f] = 'absent';
      lowConfidenceFields.push(f);
    } else {
      fieldConfidence[f] = fieldLevel;
      if (fieldLevel === 'low') lowConfidenceFields.push(f);
    }
  }

  return {
    nutrition,
    fieldConfidence,
    servingSizeG: raw.servingSizeG ?? null,
    wasPerServing: raw.isPerServing ?? false,
    overallConfidence: cappedConfidence,
    lowConfidenceFields,
    labelFormat: 'generic',
  };
}
