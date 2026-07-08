import { describe, it, expect } from 'vitest';
import { flagBiomarker, flagLabResults } from '../flag-engine.js';
import type { BiomarkerType } from '../types.js';

const HBA1C: BiomarkerType = {
  id: 'hba1c', displayName: 'HbA1c', unit: '%', normalMax: 5.6,
};
const HDL: BiomarkerType = {
  id: 'hdl_cholesterol', displayName: 'HDL Cholesterol', unit: 'mg/dL', normalMin: 40,
};
const TSH: BiomarkerType = {
  id: 'tsh', displayName: 'TSH', unit: 'mIU/L', normalMin: 0.4, normalMax: 4.5,
};

describe('flagBiomarker', () => {
  it('returns null for normal value', () => {
    expect(flagBiomarker(HBA1C, 5.2)).toBeNull();
    expect(flagBiomarker(HDL, 55)).toBeNull();
    expect(flagBiomarker(TSH, 2.0)).toBeNull();
  });

  it('flags high HbA1c as warning', () => {
    const f = flagBiomarker(HBA1C, 6.5);
    expect(f?.flag).toBe('high');
    expect(f?.severity).toBe('warning');
  });

  it('flags critically high HbA1c at 2× normal max', () => {
    // 5.6 × 2 = 11.2 → critical_high
    const f = flagBiomarker(HBA1C, 12.0);
    expect(f?.flag).toBe('critical_high');
    expect(f?.severity).toBe('critical');
  });

  it('flags low HDL as warning', () => {
    const f = flagBiomarker(HDL, 30);
    expect(f?.flag).toBe('low');
    expect(f?.severity).toBe('warning');
  });

  it('flags critically low HDL at 0.5× normal min', () => {
    // 40 × 0.5 = 20 → critical_low
    const f = flagBiomarker(HDL, 15);
    expect(f?.flag).toBe('critical_low');
    expect(f?.severity).toBe('critical');
  });

  it('includes biomarker metadata in flag output', () => {
    const f = flagBiomarker(HBA1C, 7.0);
    expect(f?.biomarkerType).toBe('hba1c');
    expect(f?.displayName).toBe('HbA1c');
    expect(f?.unit).toBe('%');
    expect(f?.value).toBe(7.0);
  });
});

describe('flagLabResults', () => {
  it('returns sorted flags by severity (critical first)', () => {
    const results = [
      { biomarkerType: 'hba1c', value: 7.0 },           // high → warning
      { biomarkerType: 'tsh',   value: 50 },             // >4.5×2=9 → critical_high
      { biomarkerType: 'hdl_cholesterol', value: 55 },   // normal
    ];
    const flags = flagLabResults(results, [HBA1C, TSH, HDL]);
    expect(flags[0]?.severity).toBe('critical');
    expect(flags[1]?.severity).toBe('warning');
    expect(flags).toHaveLength(2);
  });

  it('returns empty array when all values are normal', () => {
    const results = [
      { biomarkerType: 'hba1c', value: 5.0 },
      { biomarkerType: 'tsh',   value: 2.0 },
    ];
    const flags = flagLabResults(results, [HBA1C, TSH]);
    expect(flags).toHaveLength(0);
  });

  it('skips biomarkers not in registry', () => {
    const results = [{ biomarkerType: 'unknown_marker', value: 999 }];
    const flags = flagLabResults(results, [HBA1C]);
    expect(flags).toHaveLength(0);
  });
});
