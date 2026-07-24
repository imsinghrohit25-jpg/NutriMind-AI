import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { extractTextViaGoogleVision } from '../google-vision-ocr.js';

const originalFetch = global.fetch;

function mockFetchOnce(status: number, body: unknown): void {
  global.fetch = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  }) as unknown as typeof fetch;
}

describe('extractTextViaGoogleVision', () => {
  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('returns the real extracted text and an averaged block confidence on a well-formed response', async () => {
    mockFetchOnce(200, {
      responses: [
        {
          fullTextAnnotation: {
            text: 'PROTEIN 5g\nENERGY 250 kcal',
            pages: [{ blocks: [{ confidence: 0.9 }, { confidence: 0.8 }] }],
          },
        },
      ],
    });

    const result = await extractTextViaGoogleVision({ imageBase64: 'x'.repeat(100), apiKey: 'fake-key' });

    expect(result.available).toBe(true);
    expect(result.text).toBe('PROTEIN 5g\nENERGY 250 kcal');
    expect(result.confidence).toBeCloseTo(0.85);
    expect(result.note).toBeNull();
  });

  it('degrades gracefully with an honest note when no text is found', async () => {
    mockFetchOnce(200, { responses: [{}] });

    const result = await extractTextViaGoogleVision({ imageBase64: 'x'.repeat(100), apiKey: 'fake-key' });

    expect(result.available).toBe(false);
    expect(result.text).toBeNull();
    expect(result.note).toMatch(/no text/i);
  });

  it('degrades gracefully on a Vision API error response (e.g. invalid key), never throwing', async () => {
    mockFetchOnce(200, { responses: [{ error: { message: 'API key not valid.' } }] });

    const result = await extractTextViaGoogleVision({ imageBase64: 'x'.repeat(100), apiKey: 'bad-key' });

    expect(result.available).toBe(false);
    expect(result.note).toMatch(/API key not valid/);
  });

  it('degrades gracefully on a non-2xx HTTP status', async () => {
    mockFetchOnce(403, { responses: [] });

    const result = await extractTextViaGoogleVision({ imageBase64: 'x'.repeat(100), apiKey: 'bad-key' });

    expect(result.available).toBe(false);
    expect(result.note).toMatch(/403/);
  });

  it('degrades gracefully when the network request itself throws', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('network down')) as unknown as typeof fetch;

    const result = await extractTextViaGoogleVision({ imageBase64: 'x'.repeat(100), apiKey: 'fake-key' });

    expect(result.available).toBe(false);
    expect(result.note).toMatch(/network request failed/i);
  });

  it('degrades gracefully when the response body is not valid JSON', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.reject(new Error('bad json')),
    }) as unknown as typeof fetch;

    const result = await extractTextViaGoogleVision({ imageBase64: 'x'.repeat(100), apiKey: 'fake-key' });

    expect(result.available).toBe(false);
    expect(result.note).toMatch(/not valid JSON/i);
  });

  it('returns confidence 0 (not NaN) when no block-level confidence values are present', async () => {
    mockFetchOnce(200, { responses: [{ fullTextAnnotation: { text: 'some text', pages: [] } }] });

    const result = await extractTextViaGoogleVision({ imageBase64: 'x'.repeat(100), apiKey: 'fake-key' });

    expect(result.available).toBe(true);
    expect(result.confidence).toBe(0);
  });

  it('never includes the API key in the request URL beyond the query string param (no key logged elsewhere)', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ responses: [{ fullTextAnnotation: { text: 'x' } }] }),
    });
    global.fetch = fetchSpy as unknown as typeof fetch;

    await extractTextViaGoogleVision({ imageBase64: 'x'.repeat(100), apiKey: 'secret-key-value' });

    const [url, requestInit] = fetchSpy.mock.calls[0]!;
    expect(url).toContain('key=secret-key-value');
    expect(JSON.stringify(requestInit)).not.toContain('secret-key-value');
  });
});
