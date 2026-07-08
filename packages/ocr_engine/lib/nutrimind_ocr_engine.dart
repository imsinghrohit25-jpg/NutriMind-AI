/// NutriMind OCR Engine — hybrid ML Kit + Cloud Vision routing display/decision metadata
/// (Phase 6). Script detection and the actual cloud-vision extraction call are both server-side
/// (`POST /v1/scans/label`, `apps/api/src/scan/label-parser/{script-detector,
/// cloud-ocr-fallback}.ts`) — this package mirrors the response shape for the mobile client's
/// scanner UI, same single-source-of-truth pattern as `nutrimind_grocery_providers` (ADR-0018
/// §1) and `nutrimind_restaurant_intelligence`.
library nutrimind_ocr_engine;

export 'src/ocr_script_info.dart';
export 'src/label_format_info.dart';
