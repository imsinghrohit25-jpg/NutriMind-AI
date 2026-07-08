# Localization Strategy — NutriMind AI

## Supported Locales

| Locale | Language | Script      | Coverage |
|--------|----------|-------------|----------|
| `en`   | English  | Latin       | 100%     |
| `hi`   | Hindi    | Devanagari  | 100%     |
| `mr`   | Marathi  | Devanagari  | 100%     |

## Flutter i18n

ARB files: `apps/mobile/lib/l10n/app_{en,hi,mr}.arb`  
Generated delegate: `AppLocalizations` (via `flutter gen-l10n`)  
Config: `apps/mobile/l10n.yaml`

Locale is resolved from the device's system locale, with English as the fallback.

## Backend Content Negotiation

The API reads the `Accept-Language` header on every request:

```
Accept-Language: hi-IN;q=0.9, en;q=0.8
```

`apps/api/src/i18n/language.ts` → `resolveLocale()` returns `'hi' | 'mr' | 'en'`.

The resolved locale is:
1. Passed to LLM prompts as a language instruction suffix (`LANGUAGE_INSTRUCTIONS[locale]`)
2. Used to select localised error messages
3. Stored in request context for downstream use

## LLM Output-Language Routing

When locale is `hi` or `mr`:
- A language instruction is appended to the Copilot system prompt
- Instruction: *"Respond entirely in [Language] (Devanagari). Keep product names, nutrient labels, and scientific terms in English."*
- This keeps nutrient values (sodium, sugar) readable in any locale

## Food-Name Strategy

Indian food products commonly have:
1. Brand name in English (on packaging front)
2. Ingredient names in English (as required by FSSAI)
3. Devanagari translations in parentheses: `Wheat Flour (गेहूं का आटा)`

**Parsing rule:** English name takes precedence; Devanagari parentheticals are stripped before tokenization. Pure Devanagari ingredient lists (some unorganised sector products) are passed through without tokenization penalty — the allergen fail-safe is triggered if confidence is low.

## Devanagari OCR

ML Kit Text Recognition v2 supports Devanagari script natively. OCR confidence on Devanagari script depends on print quality and label font:

| Condition             | Expected confidence |
|-----------------------|---------------------|
| Printed label (good)  | 0.75–0.95           |
| Handwritten/embossed  | 0.40–0.65           |
| Low contrast          | 0.30–0.55           |

When OCR confidence < 0.5 → allergen fail-safe triggers regardless of language.

Tests: `apps/api/src/scan/__tests__/devanagari-ocr.test.ts`

## Translation Scope

The following are intentionally NOT translated:
- NOVA group number (1–4) — international standard
- INS numbers (E211, etc.) — technical identifiers
- Scientific nutrient names when used in medical context
- Citation references (WHO, ICMR-NIN, FSSAI)
