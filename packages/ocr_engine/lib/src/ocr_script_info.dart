/// Script support metadata — mirrors `ScriptId` and `ON_DEVICE_SUPPORTED` in the TypeScript
/// `apps/api/src/scan/label-parser/script-detector.ts` (Phase 6, `global.p6.cloud_ocr_fallback`).
/// Script *detection* and the cloud-vision fallback call both stay server-side (`POST
/// /v1/scans/label` does both in one round trip) — this is display/decision metadata only, same
/// single-source-of-truth pattern as `nutrimind_grocery_providers`' `GroceryProviderInfo`.
enum OcrScript { latin, devanagari, cjk, korean, arabic, tamil, telugu, other }

/// Scripts ML Kit Text Recognition v2 handles natively on-device — must stay identical to the
/// server's `ON_DEVICE_SUPPORTED` set in `script-detector.ts`.
const _onDeviceSupported = <OcrScript>{
  OcrScript.latin,
  OcrScript.devanagari,
  OcrScript.cjk,
  OcrScript.korean,
};

/// True when [script] is recognized by on-device ML Kit; false means the client should expect
/// the server to use the cloud vision fallback (`usedCloudOcr: true` in the scan response).
bool isOnDeviceSupported(OcrScript script) => _onDeviceSupported.contains(script);

/// Parses the `detectedScript` string returned by `POST /v1/scans/label`. Falls back to
/// [OcrScript.other] for any value this client build doesn't recognize yet (forward-compatible
/// with a server that adds a new script before the client updates).
OcrScript ocrScriptFromApi(String? value) {
  return OcrScript.values.firstWhere(
    (s) => s.name == value,
    orElse: () => OcrScript.other,
  );
}
