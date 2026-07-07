# NutriMind AI — Performance Baselines (v1)

**Status:** Phase 5 measurements. Targets and measurement methodology defined here; device matrix to be completed in Phase 11 with k6 load tests.

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

## Phase 11 additions

- k6 load test: 100 concurrent barcode scans → p99 latency < 2 s
- Device matrix: low-end (Redmi 9A, 2 GB RAM), mid-range (Redmi Note 11), high-end (Pixel 7)
- On-device OCR: Devanagari model performance on Hindi label text
- Memory profiling: no memory leak in camera lifecycle (60-scan session)
- Battery: background sync should not trigger > 5% battery in 1 hour idle

## Notes

- OCR < 2 s target applies to Latin script. Devanagari model (Phase 11) may be slower.
- Vision API calls (meal photo) are excluded from the < 2 s on-device target — they are server-side.
- All latencies are P50 unless otherwise noted; P95 targets to be defined in Phase 11 after load testing.
