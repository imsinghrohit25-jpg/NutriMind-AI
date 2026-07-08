// Deterministic biomarker flag engine — no LLM.
// Compares lab result values against reference ranges from the biomarker_types registry.
// Produces structured flags with severity tiers.

import type { BiomarkerType, BiomarkerFlag, LabResultFlag } from './types.js';

// Critical thresholds are expressed as multipliers of the normal bound.
// Values beyond these thresholds get critical_* severity.
const CRITICAL_HIGH_FACTOR = 2.0;  // 2× normal max
const CRITICAL_LOW_FACTOR  = 0.5;  // 0.5× normal min

export function flagBiomarker(
  bt:    BiomarkerType,
  value: number,
): BiomarkerFlag | null {
  const { normalMin, normalMax } = bt;
  let flag: LabResultFlag | null = null;
  let severity: BiomarkerFlag['severity'] = 'info';

  if (normalMax !== undefined && value > normalMax) {
    flag = value > normalMax * CRITICAL_HIGH_FACTOR ? 'critical_high' : 'high';
    severity = flag === 'critical_high' ? 'critical' : 'warning';
  } else if (normalMin !== undefined && value < normalMin) {
    flag = value < normalMin * CRITICAL_LOW_FACTOR ? 'critical_low' : 'low';
    severity = flag === 'critical_low' ? 'critical' : 'warning';
  }

  if (!flag) return null;

  return {
    biomarkerType: bt.id,
    displayName:   bt.displayName,
    value,
    unit:          bt.unit,
    normalMin,
    normalMax,
    flag,
    severity,
  };
}

/** Flag all abnormal values in a set of lab results. */
export function flagLabResults(
  results:  Array<{ biomarkerType: string; value: number }>,
  registry: BiomarkerType[],
): BiomarkerFlag[] {
  const registryMap = new Map(registry.map((bt) => [bt.id, bt]));
  const flags: BiomarkerFlag[] = [];

  for (const result of results) {
    const bt = registryMap.get(result.biomarkerType);
    if (!bt) continue;
    const flag = flagBiomarker(bt, result.value);
    if (flag) flags.push(flag);
  }

  return flags.sort((a, b) => {
    const order = { critical: 0, warning: 1, info: 2 };
    return order[a.severity] - order[b.severity];
  });
}
