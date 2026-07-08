// Prompt injection hardening — sanitises all user-supplied text before it reaches an LLM.
// Applied to: copilot queries, label OCR feedback, product names from user edits.
// Gate requirement: injection strings must be inert.

// Patterns that attempt to escape the user-content role and issue instructions
const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(previous|prior|all|above|system|the above)\s+(instructions?|prompts?|context|rules?)/gi,
  /\byou\s+are\s+now\b/gi,
  /\bact\s+as\b/gi,
  /\bforget\s+(everything|all|your|the)/gi,
  /\bsystem\s*:\s*/gi,
  /\bassistant\s*:\s*/gi,
  /\buser\s*:\s*/gi,
  /\[INST\]/gi,
  /<<SYS>>/gi,
  /<\|im_start\|>/gi,
  /\bDAN\b/g,    // "Do Anything Now" jailbreak marker
  /\bjailbreak\b/gi,
  /\bpretend\s+you\s+(are|have|can)/gi,
];

// Maximum length for user-supplied text sent to LLM
const MAX_USER_TEXT_LENGTH = 2000;

export interface SanitiseResult {
  text:       string;
  wasClipped: boolean;
  injectionDetected: boolean;
}

export function sanitiseUserText(raw: string): SanitiseResult {
  let text = raw;
  let injectionDetected = false;

  // Check for injection attempts
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      injectionDetected = true;
      // Redact the matched segment rather than blocking the entire query —
      // the user may have a legitimate question that happens to contain one of these phrases.
      text = text.replace(pattern, '[redacted]');
    }
  }

  // Strip null bytes and control characters (except newline, tab)
  text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // Clip to maximum length
  const wasClipped = text.length > MAX_USER_TEXT_LENGTH;
  if (wasClipped) text = text.slice(0, MAX_USER_TEXT_LENGTH) + '…';

  return { text, wasClipped, injectionDetected };
}

// Convenience wrapper: returns sanitised text or throws if injection was detected
// and the policy is to reject (default: redact and continue)
export function sanitiseForLLM(raw: string): string {
  const { text, injectionDetected } = sanitiseUserText(raw);
  if (injectionDetected) {
    // Log but do not block — logged for monitoring; malicious patterns are redacted
    console.warn('[security] Prompt injection pattern detected and redacted');
  }
  return text;
}
