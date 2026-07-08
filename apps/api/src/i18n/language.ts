// Content negotiation — parses Accept-Language header and returns a supported locale.
// Supported: en (default), hi (Hindi), mr (Marathi).
// Used to route LLM output language and localise error messages.

export type SupportedLocale = 'en' | 'hi' | 'mr';

const SUPPORTED: SupportedLocale[] = ['hi', 'mr', 'en'];  // ordered by preference specificity

export function resolveLocale(acceptLanguage: string | undefined): SupportedLocale {
  if (!acceptLanguage) return 'en';

  // Parse "hi-IN;q=0.9, en;q=0.8" → [['hi', 0.9], ['en', 0.8]]
  const parts = acceptLanguage
    .split(',')
    .map((part) => {
      const [tag, q] = part.trim().split(';q=');
      const lang = (tag ?? '').split('-')[0]!.toLowerCase();
      const quality = q != null ? parseFloat(q) : 1.0;
      return { lang, quality };
    })
    .sort((a, b) => b.quality - a.quality);

  for (const { lang } of parts) {
    if (SUPPORTED.includes(lang as SupportedLocale)) {
      return lang as SupportedLocale;
    }
  }

  return 'en';
}

// LLM output-language instruction appended to system prompts
export const LANGUAGE_INSTRUCTIONS: Record<SupportedLocale, string> = {
  en: '',  // default; no extra instruction needed
  hi: 'Respond entirely in Hindi (Devanagari script). Keep all product names, nutrient names (sodium, sugar, etc.), and scientific terms in English.',
  mr: 'Respond entirely in Marathi (Devanagari script). Keep all product names, nutrient names (sodium, sugar, etc.), and scientific terms in English.',
};
