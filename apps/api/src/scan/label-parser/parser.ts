// Label parser — extracts structured nutrition from raw OCR text.
// Returns per-100g values with per-field confidence scores.
// No LLM calls here; this is a pure deterministic regex extractor.
// Low-confidence fields are surfaced for the parse-assist step.

import type { NutritionPer100g } from '../../nutrition/canonical-model.js';
import { estimateAddedSugar, fillEnergyFields } from '../../nutrition/derived.js';
import { perServingToPer100g, parseServingSizeG } from '../../nutrition/units.js';
import { resolveLabelFormat } from './label-formats/registry.js';
import type { LabelFormatId } from './label-formats/types.js';

export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'absent';

export interface FieldResult {
  value: number | null;
  confidence: ConfidenceLevel;
  rawMatch: string | null;
}

export interface ParsedLabel {
  // Per-100g nutrition values
  nutrition: Partial<NutritionPer100g>;
  // Per-field confidence
  fieldConfidence: Record<string, ConfidenceLevel>;
  // Detected serving size (g) — null if not found
  servingSizeG: number | null;
  // Whether values were detected as per-serving and converted
  wasPerServing: boolean;
  // Overall label confidence (0–1)
  overallConfidence: number;
  // Fields that need LLM disambiguation
  lowConfidenceFields: string[];
  // Detected/specified label format (Phase 6, ADR-0019)
  labelFormat: LabelFormatId;
}

/**
 * `formatId` is optional and additive (ADR-0019, Phase 6, flag `global.p6.label_format_router`):
 * when omitted, the format is auto-detected from `rawText` via `detectLabelFormat()`, which
 * falls back to `'generic'` (the pre-Phase-6 pattern set, unchanged) unless a US Nutrition
 * Facts Panel signal ("% Daily Value" / "Amount Per Serving") is present. Existing FSSAI-format
 * fixtures — including ones that happen to say "Nutrition Facts per serving" — auto-detect as
 * `'generic'` and parse identically to pre-Phase-6 behavior.
 */
export function parseLabelText(rawText: string, formatId?: LabelFormatId): ParsedLabel {
  const text = rawText.replace(/\r\n/g, '\n');
  const format = resolveLabelFormat(text, formatId);

  // Detect context: per-100g vs per-serving
  const hasPer100g  = format.per100gPattern.test(text);
  const hasPerServing = format.perServingPattern.test(text);
  // Reset lastIndex after RegExp.test
  format.per100gPattern.lastIndex = 0;
  format.perServingPattern.lastIndex = 0;

  // Detect serving size
  let servingSizeG: number | null = null;
  for (const pattern of format.servingSizePatterns) {
    const match = pattern.exec(text);
    if (match) {
      const raw = `${match[1]} ${match[2]}`;
      servingSizeG = parseServingSizeG(raw);
      break;
    }
  }

  // Extract per-field values
  const extracted: Record<string, FieldResult> = {};

  for (const fp of format.nutritionPatterns) {
    let bestMatch: FieldResult = { value: null, confidence: 'absent', rawMatch: null };

    for (const pattern of fp.patterns) {
      pattern.lastIndex = 0;
      const match = pattern.exec(text);
      if (match) {
        const rawNum = (match[1] || match[0]).replace(',', '.');
        const value = parseFloat(rawNum);
        if (!isNaN(value)) {
          bestMatch = {
            value,
            confidence: fp.patterns.indexOf(pattern) === 0 ? 'high' : 'medium',
            rawMatch: match[0],
          };
          break;
        }
      }
    }

    extracted[fp.field] = bestMatch;
  }

  // Determine if we need to convert per-serving → per-100g
  const wasPerServing = !hasPer100g && hasPerServing && servingSizeG !== null;

  const convert = (v: number | null): number | null => {
    if (v === null || !wasPerServing || !servingSizeG) return v;
    return perServingToPer100g(v, servingSizeG);
  };

  // When converting from per-serving, confidence drops by one level
  const adjustConfidence = (c: ConfidenceLevel): ConfidenceLevel => {
    if (!wasPerServing) return c;
    if (c === 'high') return 'medium';
    if (c === 'medium') return 'low';
    return c;
  };

  const fieldConfidence: Record<string, ConfidenceLevel> = {};
  for (const [field, result] of Object.entries(extracted)) {
    fieldConfidence[field] = result.value !== null ? adjustConfidence(result.confidence) : 'absent';
  }

  // Added sugar estimation (ADR-0007)
  const directAddedSugar = extracted['sugarsAddedG']?.value ?? null;
  const totalSugars      = extracted['sugarsG']?.value ?? null;
  const { sugarsAddedG: addedSugar, sugarsAddedEstimated: addedSugarEstimated } = estimateAddedSugar(
    directAddedSugar !== null ? convert(directAddedSugar) : null,
    totalSugars !== null ? convert(totalSugars) : null,
  );

  const nowDate = new Date();
  const nutrition: Partial<NutritionPer100g> = {
    // Provenance — caller will overwrite with actual scan provenance
    source: 'label_ocr',
    sourceId: '',
    datasetVersion: 'ocr_v1',
    retrievedAt: nowDate,
    licenseClass: 'user_submitted',

    energyKcal:       convert(extracted['energyKcal']?.value ?? null),
    energyKj:         convert(extracted['energyKj']?.value ?? null),
    proteinG:         convert(extracted['proteinG']?.value ?? null),
    fatTotalG:        convert(extracted['fatTotalG']?.value ?? null),
    fatSaturatedG:    convert(extracted['fatSaturatedG']?.value ?? null),
    fatTransG:        convert(extracted['fatTransG']?.value ?? null),
    carbohydratesG:   convert(extracted['carbohydratesG']?.value ?? null),
    sugarsG:          convert(totalSugars),
    sugarsAddedG:     addedSugar,
    sugarsAddedEstimated: addedSugarEstimated,
    dietaryFiberG:    convert(extracted['fibreG']?.value ?? null),
    sodiumMg:         convert(extracted['sodiumMg']?.value ?? null),
    calciumMg:        convert(extracted['calciumMg']?.value ?? null),
    ironMg:           convert(extracted['ironMg']?.value ?? null),
    vitaminCMg:       convert(extracted['vitaminCMg']?.value ?? null),
    cholesterolMg:    convert(extracted['cholesterolMg']?.value ?? null),
    novaGroup:        null,
    confidence:       null,  // will be set from overallConfidence
    notes:            null,
  };

  fillEnergyFields(nutrition as NutritionPer100g);

  // Overall confidence: fraction of key fields extracted with high/medium confidence
  const keyFields = ['energyKcal', 'proteinG', 'fatTotalG', 'carbohydratesG', 'sodiumMg'];
  const keyHit = keyFields.filter((f) => {
    const c = fieldConfidence[f];
    return c === 'high' || c === 'medium';
  }).length;
  const overallConfidence = keyHit / keyFields.length;

  nutrition.confidence = overallConfidence;

  const lowConfidenceFields = Object.entries(fieldConfidence)
    .filter(([, c]) => c === 'low' || c === 'absent')
    .map(([f]) => f)
    .filter((f) => {
      const n = nutrition as Record<string, unknown>;
      // Only flag fields that are undefined or null — absent fields with no value
      return n[f] === null || n[f] === undefined;
    });

  return {
    nutrition,
    fieldConfidence,
    servingSizeG,
    wasPerServing,
    overallConfidence,
    lowConfidenceFields,
    labelFormat: format.id,
  };
}
