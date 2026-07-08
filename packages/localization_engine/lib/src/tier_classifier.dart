/// Translation tier classification.
/// Tier A: full human-reviewed translations.
/// Tier B: MT + human review in progress (gated behind global.p2.tier_b_languages).
/// Tier C: MT only, clearly flagged (future).
enum TranslationTier { tierA, tierB, tierC }

/// Language subtag → translation tier.
const Map<String, TranslationTier> kTranslationTiers = {
  // Tier A — Global
  'en': TranslationTier.tierA,
  'hi': TranslationTier.tierA,
  'mr': TranslationTier.tierA,
  'es': TranslationTier.tierA,
  'fr': TranslationTier.tierA,
  'de': TranslationTier.tierA,
  'ar': TranslationTier.tierA,
  'ja': TranslationTier.tierA,
  'pt': TranslationTier.tierA,
  'id': TranslationTier.tierA,
  // Tier A — Key Indian
  'ta': TranslationTier.tierA,
  'te': TranslationTier.tierA,
  'bn': TranslationTier.tierA,
  'gu': TranslationTier.tierA,
  'pa': TranslationTier.tierA,
  // Tier B — Indian regional (MT + review)
  'kn': TranslationTier.tierB,
  'ml': TranslationTier.tierB,
  'ur': TranslationTier.tierB,
  'or': TranslationTier.tierB,
  'as': TranslationTier.tierB,
  // Tier B — Global
  'ko': TranslationTier.tierB,
  'zh': TranslationTier.tierB,
  'tr': TranslationTier.tierB,
  'vi': TranslationTier.tierB,
  'th': TranslationTier.tierB,
};

TranslationTier tierFor(String languageCode) =>
    kTranslationTiers[languageCode.toLowerCase()] ?? TranslationTier.tierC;
