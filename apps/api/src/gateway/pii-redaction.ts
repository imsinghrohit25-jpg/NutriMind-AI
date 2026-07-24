// Gateway-level PII redaction — addendum to the Gemini integration (Gate 0 §4 / Architecture §4:
// "the existing redaction middleware runs before any payload reaches [a provider]"). No such
// middleware previously existed anywhere in this codebase: telemetry/redaction.ts redacts OTel
// SPAN ATTRIBUTE KEYS by field name (e.g. a span attribute literally named `user.email`), never
// the free-text CONTENT of an actual LLM request/message. This module fills that real gap —
// applied automatically in GatewayRouter.complete()/completeStream() to every request, for every
// provider (Gemini included, but not Gemini-specific — no "special path" per the master prompt's
// own anti-duplication rule).
//
// Regex-based, not an invented ML PII detector ("derived, never divined" — this codebase's
// consistent discipline elsewhere, e.g. the OCR Agent's keyword-based doc-type classifier).
// Deliberately biased toward false-positive-safe: a barcode or long numeric code mentioned in a
// free-text chat message is a much rarer real occurrence than a user pasting a real identifier,
// so when a pattern's length/shape genuinely overlaps with legitimate nutrition data (see the
// Aadhaar note below), this module still redacts — the same "prefer a false positive over a
// leaked identifier" bias the allergen fail-safe already applies to safety-relevant detection.

const EMAIL_PATTERN = /\b[\w.+-]+@[\w-]+\.[a-z]{2,}\b/gi;

// PAN (India Permanent Account Number): a fixed, exact 10-character format
// (5 letters, 4 digits, 1 letter, e.g. "ABCDE1234F") — no realistic collision with nutrition data.
const PAN_PATTERN = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/g;

// Aadhaar (India's 12-digit national ID): the real, standard way people type/paste one is
// space- or hyphen-grouped in 4s ("1234 5678 9012" / "1234-5678-9012"). A bare 12-digit run is
// ALSO matched (word-boundary anchored) since that's still a real, common way to paste one —
// this does mean a UPC-A barcode (also exactly 12 digits) typed into a chat message would be
// redacted too; that tradeoff is deliberate (see header comment) and barcodes normally flow
// through a dedicated typed API field, not free-text LLM messages, in this codebase.
const AADHAAR_GROUPED_PATTERN = /\b\d{4}[-\s]\d{4}[-\s]\d{4}\b/g;
const AADHAAR_BARE_PATTERN = /\b\d{12}\b/g;

// Indian mobile number: 10 digits starting 6-9, optional +91/91 prefix. No leading `\b`: a `+`
// prefix means the true start-of-number sits right before the digits, not before the `+` itself
// (`+` and a preceding space are both non-word characters, so no `\b` transition exists there) —
// the trailing `\b` still prevents matching only the tail of a longer digit run.
const PHONE_PATTERN = /(?:\+?91[-\s]?)?[6-9]\d{9}\b/g;

export function redactPiiText(text: string): string {
  return text
    .replace(EMAIL_PATTERN, '[redacted-email]')
    .replace(PAN_PATTERN, '[redacted-pan]')
    .replace(AADHAAR_GROUPED_PATTERN, '[redacted-aadhaar]')
    .replace(AADHAAR_BARE_PATTERN, '[redacted-aadhaar]')
    .replace(PHONE_PATTERN, '[redacted-phone]');
}

/** Redacts every free-text field of an LLMRequest (messages[].content, systemPrompt) before it
 *  reaches any provider adapter. Never touches images, tier, traceId, userId, or any other
 *  structural field — those are never free text a user typed. */
export function redactLLMRequest<T extends { messages: { role: string; content: string }[]; systemPrompt?: string }>(
  request: T,
): T {
  return {
    ...request,
    messages: request.messages.map((m) => ({ ...m, content: redactPiiText(m.content) })),
    systemPrompt: request.systemPrompt !== undefined ? redactPiiText(request.systemPrompt) : request.systemPrompt,
  };
}
