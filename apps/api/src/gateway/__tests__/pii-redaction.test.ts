import { describe, it, expect } from 'vitest';
import { redactPiiText, redactLLMRequest } from '../pii-redaction.js';

describe('redactPiiText', () => {
  it('redacts an email address', () => {
    expect(redactPiiText('contact me at asha.patel@example.com please')).toBe(
      'contact me at [redacted-email] please',
    );
  });

  it('redacts a PAN (India Permanent Account Number)', () => {
    expect(redactPiiText('my PAN is ABCDE1234F for tax purposes')).toBe(
      'my PAN is [redacted-pan] for tax purposes',
    );
  });

  it('redacts a space-grouped Aadhaar number', () => {
    expect(redactPiiText('my aadhaar is 1234 5678 9012 ok')).toBe(
      'my aadhaar is [redacted-aadhaar] ok',
    );
  });

  it('redacts a hyphen-grouped Aadhaar number', () => {
    expect(redactPiiText('aadhaar: 1234-5678-9012')).toBe('aadhaar: [redacted-aadhaar]');
  });

  it('redacts a bare 12-digit run (also catches an Aadhaar typed without separators)', () => {
    expect(redactPiiText('my id is 123456789012 done')).toBe('my id is [redacted-aadhaar] done');
  });

  it('redacts an Indian mobile number with or without +91', () => {
    expect(redactPiiText('call me at 9876543210')).toBe('call me at [redacted-phone]');
    expect(redactPiiText('call me at +91 9876543210')).toBe('call me at [redacted-phone]');
  });

  it('never redacts ordinary nutrition numbers (energy, sodium, serving size)', () => {
    const text = 'This food has 250 kcal, 700mg sodium, and a 100g serving size.';
    expect(redactPiiText(text)).toBe(text);
  });

  it('redacts multiple distinct PII items in the same text', () => {
    const text = 'Email asha@example.com or call 9876543210, PAN ABCDE1234F.';
    const result = redactPiiText(text);
    expect(result).toContain('[redacted-email]');
    expect(result).toContain('[redacted-phone]');
    expect(result).toContain('[redacted-pan]');
    expect(result).not.toContain('asha@example.com');
    expect(result).not.toContain('9876543210');
    expect(result).not.toContain('ABCDE1234F');
  });
});

describe('redactLLMRequest', () => {
  it('redacts every message content and the system prompt, leaving structural fields untouched', () => {
    const request = {
      tier: 'parse_assist' as const,
      messages: [{ role: 'user' as const, content: 'my email is a@b.com' }],
      systemPrompt: 'user phone: 9876543210',
      traceId: 'trace-1',
      userId: '11111111-1111-1111-1111-111111111111',
    };
    const redacted = redactLLMRequest(request);
    expect(redacted.messages[0]!.content).toBe('my email is [redacted-email]');
    expect(redacted.systemPrompt).toBe('user phone: [redacted-phone]');
    expect(redacted.traceId).toBe('trace-1');
    expect(redacted.userId).toBe('11111111-1111-1111-1111-111111111111');
    expect(redacted.tier).toBe('parse_assist');
  });

  it('leaves systemPrompt as undefined when not provided (never fabricates one)', () => {
    const request: { tier: 'parse_assist'; messages: { role: 'user'; content: string }[]; systemPrompt?: string; traceId: string } = {
      tier: 'parse_assist',
      messages: [{ role: 'user', content: 'hello' }],
      traceId: 'trace-2',
    };
    const redacted = redactLLMRequest(request);
    expect(redacted.systemPrompt).toBeUndefined();
  });
});
