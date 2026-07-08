// Label format detector — deterministic keyword heuristic, no LLM.
// Deliberately narrow: "nutrition facts" alone is NOT a US signal (Indian labels also use
// that exact phrase — see the BISCUIT_PER_SERVING_LABEL fixture in label-parser.test.ts).
// Only "% Daily Value" / "Amount Per Serving" reliably indicate the US format, since those
// phrases are specific to 21 CFR 101.9 and do not appear on FSSAI/generic-style labels.

import type { LabelFormatId } from './types.js';

const US_NFP_SIGNAL = /%?\s*daily\s+value|amount\s+per\s+serving/i;

export function detectLabelFormat(rawText: string): LabelFormatId {
  return US_NFP_SIGNAL.test(rawText) ? 'us_nfp' : 'generic';
}
