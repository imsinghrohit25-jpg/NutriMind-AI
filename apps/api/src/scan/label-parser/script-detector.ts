// OCR script detection — deterministic, Unicode-property based, no LLM.
// Phase 6 (`global.p6.cloud_ocr_fallback`). Mirrors `packages/ocr_engine`'s stated scope:
// ML Kit Text Recognition v2 handles Latin, Devanagari, CJK (Han/Hiragana/Katakana), and
// Korean (Hangul) natively on-device. Arabic, Tamil, Telugu, and other scripts it does not
// support well need the cloud vision fallback.

export type ScriptId =
  | 'latin' | 'devanagari' | 'cjk' | 'korean'
  | 'arabic' | 'tamil' | 'telugu' | 'other';

const SCRIPT_PATTERNS: Array<[ScriptId, RegExp]> = [
  ['devanagari', /\p{Script=Devanagari}/gu],
  ['arabic',     /\p{Script=Arabic}/gu],
  ['tamil',      /\p{Script=Tamil}/gu],
  ['telugu',     /\p{Script=Telugu}/gu],
  ['korean',     /\p{Script=Hangul}/gu],
  ['cjk',        /\p{Script=Han}|\p{Script=Hiragana}|\p{Script=Katakana}/gu],
  ['latin',      /\p{Script=Latin}/gu],
];

// Scripts ML Kit Text Recognition v2 supports natively on-device.
const ON_DEVICE_SUPPORTED: ReadonlySet<ScriptId> = new Set(['latin', 'devanagari', 'cjk', 'korean']);

/**
 * Classify the dominant script present in `text` by character count. Digits, punctuation,
 * and whitespace (the Unicode "Common" script) are ignored — only characters that fall into
 * one of the known script ranges count. Falls back to `'latin'` when no script characters are
 * found at all (empty text, or text containing only digits/punctuation, e.g. a barcode or a
 * blank OCR read) — there is no complex script to fail to recognize, so treating it as
 * "on-device fine, no cloud fallback needed" is the safe default. A non-empty string that
 * *does* contain letters but from a script this module doesn't enumerate falls to `'other'`
 * (needs cloud fallback) — a genuinely different case from "no letters at all".
 */
export function detectScript(text: string): ScriptId {
  if (!text.trim()) return 'latin';

  const counts: Partial<Record<ScriptId, number>> = {};
  for (const [script, pattern] of SCRIPT_PATTERNS) {
    const matches = text.match(pattern);
    if (matches && matches.length > 0) counts[script] = matches.length;
  }

  const entries = Object.entries(counts) as Array<[ScriptId, number]>;
  if (entries.length === 0) {
    return /\p{Letter}/u.test(text) ? 'other' : 'latin';
  }

  entries.sort((a, b) => b[1] - a[1]);
  return entries[0]![0];
}

/** True when `script` requires the cloud OCR fallback (not supported by on-device ML Kit). */
export function needsCloudOcrFallback(script: ScriptId): boolean {
  return !ON_DEVICE_SUPPORTED.has(script);
}
