// Nutrition Label Format types — Phase 6 (`global.p6.label_format_router`).
// A LabelFormat bundles the regex pattern set used to extract nutrition fields from raw
// OCR text for one label layout convention. Adding a new country's label format requires:
// (1) add a format file here, (2) register it in registry.ts, (3) add a detection rule to
// detector.ts. No parser.ts changes required.

export interface FieldPattern {
  field: string;
  patterns: RegExp[];
  unit: 'kcal' | 'kj' | 'g' | 'mg' | 'mcg' | 'iu' | 'percent';
}

export type LabelFormatId = 'generic' | 'us_nfp';

export interface LabelFormat {
  id: LabelFormatId;
  displayName: string;
  nutritionPatterns: FieldPattern[];
  servingSizePatterns: RegExp[];
  per100gPattern: RegExp;
  perServingPattern: RegExp;
}
