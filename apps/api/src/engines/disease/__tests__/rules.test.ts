import { describe, it, expect } from 'vitest';
import { evaluateDiseaseRules, worstSeverity, CONDITION_LABELS } from '../index.js';
import { highCholesterolRule } from '../rules/high-cholesterol.js';
import { heartDiseaseRule } from '../rules/heart-disease.js';
import { kidneyDiseaseRule } from '../rules/kidney-disease.js';
import { fattyLiverRule } from '../rules/fatty-liver.js';
import { pcosRule } from '../rules/pcos.js';
import { thyroidRule } from '../rules/thyroid.js';
import { pregnancyRule, lactationRule } from '../rules/pregnancy.js';
import { obesityRule } from '../rules/obesity.js';
import { CITATIONS } from '../citations.js';
import { CONDITION_GUIDANCE } from '../guidance.js';

describe('condition rules — thresholds and null-safety', () => {
  it('high cholesterol: trans fat is a warning regardless of sat fat', () => {
    const r = highCholesterolRule(0.5, 1.2, null);
    expect(r.triggered).toBe(true);
    expect(r.severity).toBe('warning');
    expect(r.message).toContain('trans fat');
  });

  it('high cholesterol: null inputs never trigger', () => {
    expect(highCholesterolRule(null, null, null).triggered).toBe(false);
    expect(highCholesterolRule(undefined, undefined, undefined).triggered).toBe(false);
  });

  it('heart disease: combines sodium + sat fat into one warning message', () => {
    const r = heartDiseaseRule(450, 8, null);
    expect(r.severity).toBe('warning');
    expect(r.message).toContain('sodium');
    expect(r.message).toContain('saturated fat');
  });

  it('kidney disease: sodium warning takes precedence; potassium and protein are cautions', () => {
    expect(kidneyDiseaseRule(400, null, null).severity).toBe('warning');
    const caution = kidneyDiseaseRule(100, 350, 20);
    expect(caution.severity).toBe('caution');
    expect(caution.message).toContain('potassium');
    expect(caution.message).toContain('protein');
  });

  it('fatty liver: added sugar preferred over total sugar for the threshold', () => {
    // total sugar high but added sugar low → added governs, no warning
    expect(fattyLiverRule(15, 2, null).severity).toBe(null);
    expect(fattyLiverRule(15, 12, null).severity).toBe('warning');
  });

  it('PCOS: refined-carb proxy (high carbs, near-zero fiber) triggers caution', () => {
    const r = pcosRule(2, null, 70, 0.5);
    expect(r.triggered).toBe(true);
    expect(r.severity).toBe('caution');
    expect(r.message).toContain('refined');
  });

  it('thyroid: soy in ingredients triggers; no ingredients list means no trigger', () => {
    expect(thyroidRule('wheat flour, soy lecithin, sugar').triggered).toBe(true);
    expect(thyroidRule('wheat flour, sugar').triggered).toBe(false);
    expect(thyroidRule(null).triggered).toBe(false);
  });

  it('thyroid: with no medications declared, keeps the conservative always-caution-on-soy behavior', () => {
    expect(thyroidRule('soy lecithin', []).triggered).toBe(true);
  });

  it('thyroid: medications declared but none are thyroid hormone -> no trigger', () => {
    expect(thyroidRule('soy lecithin', ['metformin', 'ibuprofen']).triggered).toBe(false);
  });

  it('thyroid: a declared thyroid medication -> triggers with a sharper message', () => {
    const r = thyroidRule('soy lecithin', ['levothyroxine 50mcg']);
    expect(r.triggered).toBe(true);
    expect(r.message).toContain('thyroid medication');
  });

  it('lactation: alcohol and high-mercury fish both warn; unrelated ingredients do not', () => {
    expect(lactationRule('contains alcohol 5%').severity).toBe('warning');
    expect(lactationRule('shark fin soup base').severity).toBe('warning');
    expect(lactationRule('wheat flour, sugar').triggered).toBe(false);
    expect(lactationRule(null).triggered).toBe(false);
  });

  it('pregnancy: alcohol beats vitamin A in priority; unpasteurised dairy warns', () => {
    const alcohol = pregnancyRule(6000, 'water, malt, alcohol 5%');
    expect(alcohol.message).toContain('alcohol');
    expect(pregnancyRule(null, 'unpasteurised cheese').severity).toBe('warning');
    expect(pregnancyRule(6000, null).severity).toBe('warning');
    expect(pregnancyRule(3000, null).severity).toBe('caution');
  });

  it('obesity: energy density warning above 500 kcal/100g', () => {
    expect(obesityRule(550, null, null).severity).toBe('warning');
    expect(obesityRule(450, null, null).severity).toBe('caution');
    expect(obesityRule(200, 12, null).severity).toBe('caution');
    expect(obesityRule(200, 2, null).triggered).toBe(false);
  });
});

describe('evaluateDiseaseRules — orchestrator', () => {
  const highSugarHighSodium = {
    energyKcal: 520, proteinG: 5, carbohydratesG: 60, sugarsG: 22, sugarsAddedG: null,
    dietaryFiberG: 1, fatSaturatedG: 9, fatTransG: null, sodiumMg: 480,
    potassiumMg: null, cholesterolMg: null, vitaminAIu: null,
  };

  it('evaluates exactly the conditions the user has, in order, with labels', () => {
    const results = evaluateDiseaseRules({
      nutrition: highSugarHighSodium,
      conditions: ['diabetes', 'hypertension', 'obesity'],
    });
    expect(results.map((r) => r.condition)).toEqual(['diabetes', 'hypertension', 'obesity']);
    expect(results.every((r) => r.triggered)).toBe(true);
    expect(results[0]!.conditionLabel).toBe('Diabetes');
  });

  it('ignores unknown slugs (e.g. "other") instead of throwing', () => {
    const results = evaluateDiseaseRules({
      nutrition: highSugarHighSodium,
      conditions: ['other', 'diabetes'],
    });
    expect(results).toHaveLength(1);
    expect(results[0]!.condition).toBe('diabetes');
  });

  it('handles null nutrition without throwing (nothing triggers)', () => {
    const results = evaluateDiseaseRules({ nutrition: null, conditions: ['diabetes', 'obesity'] });
    expect(results.every((r) => !r.triggered)).toBe(true);
  });

  it('worstSeverity picks warning over caution over null', () => {
    const evals = evaluateDiseaseRules({
      nutrition: highSugarHighSodium,
      conditions: ['diabetes', 'thyroid'],
    });
    expect(worstSeverity(evals)).toBe('warning');
    expect(worstSeverity([])).toBe(null);
  });

  it('every triggered result cites only registered citations', () => {
    const results = evaluateDiseaseRules({
      nutrition: highSugarHighSodium,
      ingredientsText: 'soy protein, unpasteurised milk',
      conditions: Object.keys(CONDITION_LABELS),
    });
    for (const r of results.filter((x) => x.triggered)) {
      expect(r.citationIds.length).toBeGreaterThan(0);
      for (const id of r.citationIds) {
        expect(CITATIONS[id], `missing citation ${id}`).toBeDefined();
      }
    }
  });

  it('passes medications through to sharpen the thyroid rule', () => {
    const noMeds = evaluateDiseaseRules({
      nutrition: {}, ingredientsText: 'soy lecithin', conditions: ['thyroid'],
    });
    expect(noMeds[0]!.triggered).toBe(true); // conservative default: no medications declared

    const unrelatedMeds = evaluateDiseaseRules({
      nutrition: {}, ingredientsText: 'soy lecithin', conditions: ['thyroid'], medications: ['metformin'],
    });
    expect(unrelatedMeds[0]!.triggered).toBe(false);
  });

  it('reproductive_status "pregnant" adds pregnancy guidance even without the condition chip ticked', () => {
    const results = evaluateDiseaseRules({
      nutrition: { vitaminAIu: 6000 }, conditions: [], reproductiveStatus: 'pregnant',
    });
    expect(results).toHaveLength(1);
    expect(results[0]!.condition).toBe('pregnancy');
    expect(results[0]!.triggered).toBe(true);
  });

  it('reproductive_status "pregnant" does not duplicate an already-ticked pregnancy condition', () => {
    const results = evaluateDiseaseRules({
      nutrition: { vitaminAIu: 6000 }, conditions: ['pregnancy'], reproductiveStatus: 'pregnant',
    });
    expect(results).toHaveLength(1);
  });

  it('reproductive_status "lactating" adds a lactation evaluation with no matching condition chip', () => {
    const results = evaluateDiseaseRules({
      nutrition: {}, ingredientsText: 'shark steak', conditions: [], reproductiveStatus: 'lactating',
    });
    expect(results).toHaveLength(1);
    expect(results[0]!.condition).toBe('lactation');
    expect(results[0]!.triggered).toBe(true);
  });
});

describe('guidance catalogue — completeness', () => {
  it('covers all 10 conditions with non-empty cited content', () => {
    const expected = ['diabetes', 'hypertension', 'high_cholesterol', 'heart_disease',
      'kidney_disease', 'fatty_liver', 'pcos', 'thyroid', 'pregnancy', 'obesity', 'lactation'];
    for (const c of expected) {
      const g = CONDITION_GUIDANCE[c];
      expect(g, `guidance missing for ${c}`).toBeDefined();
      expect(g!.safeFoods.length).toBeGreaterThan(0);
      expect(g!.avoidFoods.length).toBeGreaterThan(0);
      expect(g!.recommendations.length).toBeGreaterThan(0);
      for (const id of g!.citationIds) {
        expect(CITATIONS[id], `guidance ${c} cites unregistered ${id}`).toBeDefined();
      }
    }
  });

  it('guidance labels match the rule orchestrator labels', () => {
    for (const [slug, g] of Object.entries(CONDITION_GUIDANCE)) {
      expect(g.label).toBe(CONDITION_LABELS[slug]);
    }
  });
});
