import { describe, it, expect } from 'vitest';
import { checkOutputPolicy, requiresDisclaimer } from '../output-policy.js';

describe('checkOutputPolicy', () => {
  it('passes clean nutritional content', () => {
    const result = checkOutputPolicy(
      'This product contains 250 calories per serving with 12g protein.',
    );
    expect(result.ok).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('blocks diagnosis language', () => {
    const result = checkOutputPolicy(
      'Based on the ingredients, you have a high risk of diabetes.',
    );
    expect(result.ok).toBe(false);
    expect(result.violations.some((v) => v.includes('forbidden-diagnosis'))).toBe(true);
  });

  it('blocks cure language', () => {
    const result = checkOutputPolicy('Eating this will cure your hypertension.');
    expect(result.ok).toBe(false);
    expect(result.violations.some((v) => v.includes('forbidden-diagnosis'))).toBe(true);
  });

  it('blocks stop-medication language', () => {
    const result = checkOutputPolicy(
      'After eating this, stop taking your medication.',
    );
    expect(result.ok).toBe(false);
  });

  it('blocks replace-doctor language', () => {
    const result = checkOutputPolicy('This product can replace your physician.');
    expect(result.ok).toBe(false);
  });

  it('catches score contradiction: low score + healthy claim', () => {
    const result = checkOutputPolicy(
      'This is a very healthy and nutritious product!',
      { healthScore: 2.5 },
    );
    expect(result.ok).toBe(false);
    expect(result.violations.some((v) => v.includes('score-contradiction'))).toBe(true);
  });

  it('passes healthy claim on high-scoring product', () => {
    const result = checkOutputPolicy(
      'This is a very healthy and nutritious product!',
      { healthScore: 8.0 },
    );
    expect(result.ok).toBe(true);
  });

  it('catches score contradiction: high score + dangerous claim', () => {
    const result = checkOutputPolicy(
      'Warning: this product is extremely unhealthy and dangerous!',
      { healthScore: 8.5 },
    );
    expect(result.ok).toBe(false);
    expect(result.violations.some((v) => v.includes('score-contradiction'))).toBe(true);
  });

  it('allows borderline language outside nutrition context', () => {
    const result = checkOutputPolicy(
      'This pasta sauce treats your taste buds to a delicious experience.',
    );
    expect(result.ok).toBe(true);
  });

  it('allows standard copilot nutritional guidance', () => {
    const result = checkOutputPolicy(
      'Reducing sodium intake can help manage blood pressure. Consult your doctor for personalised advice.',
    );
    expect(result.ok).toBe(true);
  });

  it('accumulates multiple violations', () => {
    const result = checkOutputPolicy(
      'You have diabetes. This will cure your condition. Stop taking your medication.',
    );
    expect(result.violations.length).toBeGreaterThanOrEqual(2);
  });
});

describe('requiresDisclaimer', () => {
  it('requires disclaimer for copilot health content', () => {
    expect(
      requiresDisclaimer('copilot_reasoning', 'Your daily calorie intake should be around 2000.'),
    ).toBe(true);
  });

  it('does not require disclaimer for non-copilot tier', () => {
    expect(
      requiresDisclaimer('parse_assist', 'This product has 250 calories.'),
    ).toBe(false);
  });

  it('does not require disclaimer for copilot non-health content', () => {
    expect(requiresDisclaimer('copilot_reasoning', 'Hello, how can I help you?')).toBe(false);
  });
});
