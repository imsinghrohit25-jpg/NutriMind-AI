// Score algorithm version — MUST be incremented whenever thresholds or weights change.
// This value is stored in health_scores.algorithm_version for audit trail.
// Consumers can detect score changes by comparing versions.

export const SCORE_ALGORITHM_VERSION = '1.0.0';

// Changelog
// 1.0.0 (2026-07-07): Initial India-adapted Nutri-Score.
//   Thresholds: ICMR-NIN 2020 RDA, WHO 2023 salt guidelines, FSSAI food labelling regulations 2022.
//   Weights: sodium 20%, sugar 20%, sat-fat 15%, trans-fat 10%, fibre 15%, protein 10%, nova 10%.
