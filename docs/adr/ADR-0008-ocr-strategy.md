# ADR-0008 — OCR Strategy: On-Device ML Kit First, Server Parse on Low Confidence

**Status:** Accepted  
**Date:** 2026-07-07  
**Deciders:** NutriMind AI project

## Context

Indian food labels are often:
- Bilingual (English + regional language)
- Low contrast (gold on orange, white on cream)
- Dense (FSSAI mandates 20+ data points in a small panel)
- Distorted by camera angle or curved packaging

The app must extract structured nutrition data from label photos.

## Decision

**Two-stage pipeline:**

1. **On-device OCR** (google_mlkit_text_recognition, Latin script)  
   - Fast (< 2 s), fully offline, no API cost  
   - Produces raw text and a heuristic confidence score  
   - Confidence = fraction of known nutrition keywords matched (energy, protein, fat, …)

2. **Server-side parse** (Phase 5, not yet implemented)  
   - If on-device confidence < 0.5: send raw text to API for LLM-assisted structured extraction  
   - Structured output validated against canonical nutrition model  
   - User confirmation shown when confidence < 0.3 before sending to server  

## Rationale

| Concern | Decision |
|---|---|
| Offline support | On-device first — partial data available without network |
| Privacy | Raw label text sent to server only when needed (confidence < 0.5); image never sent unless user consents |
| Cost | Free on-device for most high-quality scans; server only for hard cases |
| Latency | On-device: < 2 s target; server: additional 2–5 s acceptable for hard labels |
| Indian labels | Latin script model covers English; Phase 6 will add Devanagari model |

## Confidence heuristic

Keywords checked (case-insensitive, in extracted text):  
`energy`, `protein`, `fat`, `carbohydrate`, `sodium`, `calories`, `serving`, `per 100`, `kcal`, `kj`

- ≥ 5/10 matched → high confidence (direct use)  
- 3–4/10 → medium (use with "confirm details" UI)  
- < 3/10 → low (show confirmation, offer to retry scan)

## Alternatives considered

- **Server OCR only**: Requires network; violates offline-first principle.
- **Tesseract (on-device)**: Heavier binary; lower accuracy than ML Kit on mobile cameras; no Android integration path.
- **ML Kit + custom model**: Future option for Devanagari; deferred to Phase 6.

## Consequences

- Phase 5 must implement the server-side parse endpoint (`POST /v1/scans/ocr`)  
- `OcrResult.needsUserConfirmation` flag drives UI — scanner shows "confirm details" sheet when true  
- Image compression mandatory before any server upload (< 1 MB limit enforced in pipeline.dart)  
- User must explicitly consent to sending images (covered by consent gate in onboarding)
