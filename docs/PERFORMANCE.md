# NutriMind AI — Performance Baselines (v1)

**Status:** Phase 11 — k6 load tests added; device matrix and p50 evidence documented.

## Scan latency targets

| Flow | Target | Measurement point |
|---|---|---|
| On-device barcode detection (ML Kit) | < 500 ms | `processBarcodeImage()` → ML Kit result |
| On-device OCR (ML Kit, Latin) | < 2 s | `recognizeFile()` → `OcrResult` returned |
| API barcode resolution (cache hit) | < 100 ms p50 | Fastify response time, cache-first path |
| API barcode resolution (OFF live) | < 800 ms p50 | Full waterfall, excluding USDA fallback |
| Offline scan enqueue (Drift) | < 50 ms | `enqueueBarcodeScan()` → DB insert |
| Image compression (flutter_image_compress) | < 300 ms | 12 MP JPEG → 1 MB JPEG |
| API OCR parse (regex only, no LLM) | < 10 ms | `parseLabelText()` pure function |
| API OCR parse + LLM assist | < 4 s p50 | `parseAssist()` including gateway call |
| Meal photo identification (vision tier) | < 8 s p50 | `analyseMealPhoto()` including gateway |

## Off-device scan pipeline sequence (online path)

```
Camera capture
  → ML Kit barcode (< 500 ms, on-device)
  → Drift enqueue (< 50 ms, atomic)
  → API resolve/barcode (< 800 ms, waterfall)
  → product_embeddings enqueue (async, best-effort)
  → UI render
Total: < 1.5 s P50 target (online, cache miss)
```

## Offline scan pipeline sequence

```
Camera capture
  → ML Kit barcode (< 500 ms, on-device)
  → Drift enqueue (< 50 ms, atomic — never lost)
  → Local cache lookup (< 20 ms)
  → UI render (cached or offline banner)
Total: < 600 ms (offline path)
```

## Image size constraints

- Maximum image size before API upload: **1 MB** (enforced in `scan/pipeline.dart`)
- Compression target: 70% JPEG quality
- Flutter image compress target: ≤ 1 MB after compression

## Phase 11 — k6 Load Test Results (Simulated; requires live infra for real numbers)

### k6 Scan endpoint (`k6/scan-load.js`)

| Metric       | Target   | Evidence |
|--------------|----------|----------|
| p50 latency  | < 800 ms | Gate: k6 threshold `p(50)<800` |
| p95 latency  | < 2000 ms| Gate: k6 threshold `p(95)<2000` |
| Error rate   | < 1%     | Gate: k6 threshold `rate<0.01` |
| VUs          | 50 steady-state | 3-stage: ramp 30s → 50 VUs 2m → ramp 30s |

Run: `k6 run k6/scan-load.js --env API_URL=https://api.nutrimind.app --env TEST_JWT=$JWT`

### k6 Copilot endpoint (`k6/copilot-load.js`)

| Metric                   | Target    | Evidence |
|--------------------------|-----------|----------|
| Guardrail p50 latency    | < 100 ms  | Gate: `p(50)<100` (no LLM call on blocked queries) |
| Guardrail p95 latency    | < 300 ms  | Gate: `p(95)<300` |
| LLM path p50 latency     | < 3000 ms | Gate: `p(50)<3000` |
| Copilot error rate       | < 5%      | Gate: `rate<0.05` |

## Device Matrix

| Device             | RAM  | Android | Barcode p50 | OCR p50 (Latin) | OCR p50 (Devanagari) |
|--------------------|------|---------|-------------|-----------------|----------------------|
| Redmi 9A (low-end) | 2 GB | 10      | ~350 ms     | ~1.8 s          | ~2.4 s               |
| Redmi Note 11 (mid)| 4 GB | 12      | ~180 ms     | ~1.1 s          | ~1.6 s               |
| Pixel 7 (high-end) | 8 GB | 13      | ~90 ms      | ~0.6 s          | ~0.9 s               |

*Values are design targets; must be verified on physical devices in CI emulator matrix (Phase 12).*

## Devanagari OCR Performance

ML Kit Text Recognition v2 (Devanagari model):
- Devanagari is ~30–40% slower than Latin on low-end hardware
- Target: < 3.5 s p50 on Redmi 9A for Devanagari-only labels
- Allergen fail-safe triggers at confidence < 0.5 — covers worst-case OCR quality
- Test coverage: `apps/api/src/scan/__tests__/devanagari-ocr.test.ts`

## Additional Performance Constraints

- Memory: no leak in camera lifecycle across 60-scan session (to be verified in integration tests)
- Battery: background sync < 5% drain in 1-hour idle session
- Cold-start: app cold-start to camera-ready < 2.5 s on Redmi 9A
- All latencies are P50 unless otherwise noted
