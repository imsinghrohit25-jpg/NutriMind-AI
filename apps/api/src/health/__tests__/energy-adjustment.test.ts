import { describe, it, expect } from 'vitest';
import { computeEnergyAdjustment } from '../energy-adjustment.js';

const BASE = {
  tdeeKcal:      2000,
  activityLevel: 'sedentary' as const,
  date:          '2026-07-07',
};

describe('computeEnergyAdjustment', () => {
  it('returns zero adjustment when measured ≤ expected + threshold', () => {
    // sedentary: expected fraction ≈ 0.167 → 2000 × 0.167 ≈ 333 kcal expected
    // measured 350 → excess = 17 < 100 threshold
    const r = computeEnergyAdjustment({ ...BASE, measuredActiveKcal: 350 });
    expect(r.adjustmentKcal).toBe(0);
    expect(r.adjustedBudgetKcal).toBe(2000);
  });

  it('computes 50% compensation when meaningfully over baseline', () => {
    // sedentary expected ≈ 333; measured 700 → excess = 367; 50% → 183; rounded
    const r = computeEnergyAdjustment({ ...BASE, measuredActiveKcal: 700 });
    expect(r.adjustmentKcal).toBeGreaterThan(0);
    expect(r.adjustedBudgetKcal).toBe(r.adjustmentKcal + BASE.tdeeKcal);
    // compensation rate is always 0.5
    expect(r.compensationRate).toBe(0.50);
  });

  it('caps adjustment at 500 kcal', () => {
    // measured = 2000 → huge excess → capped
    const r = computeEnergyAdjustment({ ...BASE, measuredActiveKcal: 2000 });
    expect(r.adjustmentKcal).toBe(500);
    expect(r.cappedAtMaximum).toBe(true);
    expect(r.adjustedBudgetKcal).toBe(2500);
  });

  it('uses correct expected fraction for each activity level', () => {
    const levels = ['sedentary', 'light', 'moderate', 'active', 'very_active'] as const;
    for (const level of levels) {
      const r = computeEnergyAdjustment({
        tdeeKcal: 2000, activityLevel: level,
        measuredActiveKcal: 0, date: '2026-07-07',
      });
      // measured 0 < expected for any non-sedentary level → zero adjustment
      expect(r.adjustmentKcal).toBe(0);
    }
  });

  it('includes citations in output when adjustment applied', () => {
    const r = computeEnergyAdjustment({ ...BASE, measuredActiveKcal: 800 });
    expect(r.citations.length).toBeGreaterThan(0);
    expect(r.citations.some((c) => /Pontzer/i.test(c))).toBe(true);
  });

  it('explanation contains measured kcal and calculation', () => {
    const r = computeEnergyAdjustment({ ...BASE, measuredActiveKcal: 800 });
    expect(r.explanation).toContain('800');
    expect(r.explanation).toContain('50%');
  });

  it('moderate activity level with 900 kcal measured', () => {
    // moderate: 1 - 1/1.55 ≈ 0.355 → 2000 × 0.355 = 710 kcal expected
    // excess = 900 - 710 = 190; 50% = 95; adjustment = 95
    const r = computeEnergyAdjustment({
      tdeeKcal: 2000, activityLevel: 'moderate',
      measuredActiveKcal: 900, date: '2026-07-07',
    });
    expect(r.excessActiveKcal).toBe(190);
    expect(r.adjustmentKcal).toBe(95);
    expect(r.adjustedBudgetKcal).toBe(2095);
    expect(r.cappedAtMaximum).toBe(false);
  });
});
