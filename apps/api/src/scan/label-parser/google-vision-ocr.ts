// Google Cloud Vision OCR — text extraction only (Gemini/Vision integration, flag
// `global.p14.google_vision_ocr`, default off). Deliberately narrow: this module's only job is
// turning an image into raw text, exactly like ML Kit's on-device OCR already does for the
// primary path. It never interprets, identifies, or reasons about that text — the existing,
// unchanged `parseLabelText()` extracts nutrition numbers from it (deterministic, unchanged
// determinism boundary), and the existing `enrichLabelWithGemini()` (already built this session)
// optionally adds food identification/ingredient interpretation/explanation on top. Nothing here
// duplicates the AI Gateway: Vision's REST API is a pure image-to-text annotation service, not a
// chat-completion API, so it was never going to fit the LLMProvider interface — a raw fetch call
// is used rather than adding a new SDK dependency for what is, structurally, a single REST call.
//
// Graceful degradation: any failure (network, auth, no text found) returns `available: false`
// with an honest note — the caller falls back to the existing gateway-based cloud-OCR path,
// never a thrown error and never a silent empty result presented as a real reading.

export interface VisionOcrResult {
  available: boolean;
  text: string | null;
  confidence: number;
  note: string | null;
}

interface VisionAnnotateResponseEntry {
  fullTextAnnotation?: {
    text?: string;
    pages?: Array<{
      blocks?: Array<{ confidence?: number }>;
    }>;
  };
  error?: { message?: string };
}

interface VisionAnnotateResponse {
  responses?: VisionAnnotateResponseEntry[];
}

function averageBlockConfidence(response: VisionAnnotateResponseEntry): number {
  const blocks = response.fullTextAnnotation?.pages?.flatMap((p) => p.blocks ?? []) ?? [];
  const confidences = blocks.map((b) => b.confidence).filter((c): c is number => typeof c === 'number');
  if (confidences.length === 0) return 0;
  return confidences.reduce((sum, c) => sum + c, 0) / confidences.length;
}

/** Extracts raw text from an image via Google Cloud Vision's DOCUMENT_TEXT_DETECTION feature —
 *  the feature type Google recommends for dense printed text (nutrition labels, ingredient
 *  lists) rather than TEXT_DETECTION (scattered text in photos). */
export async function extractTextViaGoogleVision(opts: {
  imageBase64: string;
  apiKey: string;
}): Promise<VisionOcrResult> {
  const { imageBase64, apiKey } = opts;

  let res: Response;
  try {
    res = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [
          {
            image: { content: imageBase64 },
            features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
          },
        ],
      }),
    });
  } catch {
    return { available: false, text: null, confidence: 0, note: 'Vision OCR unavailable — the network request failed.' };
  }

  let data: VisionAnnotateResponse;
  try {
    data = (await res.json()) as VisionAnnotateResponse;
  } catch {
    return { available: false, text: null, confidence: 0, note: 'Vision OCR unavailable — the response was not valid JSON.' };
  }

  const first = data.responses?.[0];
  if (!res.ok || !first || first.error) {
    return { available: false, text: null, confidence: 0, note: `Vision OCR unavailable — ${first?.error?.message ?? `HTTP ${res.status}`}.` };
  }

  const text = first.fullTextAnnotation?.text ?? null;
  if (!text) {
    return { available: false, text: null, confidence: 0, note: 'Vision OCR found no text in this image.' };
  }

  return { available: true, text, confidence: averageBlockConfidence(first), note: null };
}
