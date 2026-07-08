/// Nutrition label format identifiers — mirrors `LabelFormatId` in the TypeScript
/// `apps/api/src/scan/label-parser/label-formats/types.ts` (Phase 6,
/// `global.p6.label_format_router`). Extraction itself is server-side (`parseLabelText()`); this
/// is display metadata only (e.g. label_flow.dart showing "Detected: US Nutrition Facts Panel").
enum LabelFormat { generic, usNfp }

const _displayNames = <LabelFormat, String>{
  LabelFormat.generic: 'Generic (FSSAI-style per-100g/per-serving)',
  LabelFormat.usNfp: 'US Nutrition Facts Panel',
};

/// Human-readable name for [format], for confirmation-UI display.
String labelFormatDisplayName(LabelFormat format) => _displayNames[format]!;

/// Parses the `labelFormat` string returned by `POST /v1/scans/label` and `/v1/scans/ocr`
/// (the API's `LabelFormatId` uses snake_case `us_nfp`). Falls back to [LabelFormat.generic] —
/// the same default the server's `resolveLabelFormat()` auto-detection falls back to.
LabelFormat labelFormatFromApi(String? value) {
  switch (value) {
    case 'us_nfp':
      return LabelFormat.usNfp;
    case 'generic':
    default:
      return LabelFormat.generic;
  }
}
