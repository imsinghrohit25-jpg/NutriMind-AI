// Corpus versioning — tracks which version of the knowledge base is active.
// Version is a semver string incremented when any document is added, updated, or removed.
// The version is stored on every embedded chunk and used for cache invalidation.

export const CORPUS_VERSION = '1.0.0';

// Changelog:
// 1.0.0 (2026-07-07): Initial corpus.
//   Documents: WHO sodium guideline, WHO sugar guideline, ICMR-NIN RDA 2020 (summary),
//   FSSAI labelling regulations 2022 (summary), WHO hypertension 2021 (summary),
//   RSSDI-ESI diabetes 2018 (summary), NOVA classification 2019.
