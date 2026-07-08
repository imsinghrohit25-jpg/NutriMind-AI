import type { LabelFormat, LabelFormatId } from './types.js';
import { GENERIC_FORMAT } from './generic.js';
import { US_NFP_FORMAT } from './us_nfp.js';
import { detectLabelFormat } from './detector.js';

const FORMAT_REGISTRY: Record<LabelFormatId, LabelFormat> = {
  generic: GENERIC_FORMAT,
  us_nfp: US_NFP_FORMAT,
};

export function getLabelFormat(id: LabelFormatId): LabelFormat {
  return FORMAT_REGISTRY[id];
}

/** Resolve a format explicitly, or auto-detect from the raw OCR text when `id` is omitted. */
export function resolveLabelFormat(rawText: string, id?: LabelFormatId): LabelFormat {
  return getLabelFormat(id ?? detectLabelFormat(rawText));
}

export { GENERIC_FORMAT, US_NFP_FORMAT, detectLabelFormat };
export type { LabelFormat, LabelFormatId };
