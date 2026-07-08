/// Privacy regime resolution — mirrors `apps/api/src/privacy/regime.ts` (Phase 8,
/// `global.p8.gdpr_consent_flow`/`dpdp_consent_flow`). Structural citations of real statute
/// provisions, not generated legal advice — same "single-pass approximation, licensed review
/// required before enabling for real users" caveat as the nutrition-standard packs.
enum PrivacyRegime { gdpr, dpdp, generic }

// Same 6-country EU/UK-GDPR set as the server's `region/registry.ts` EU_UK_GDPR.
const _gdprCountries = <String>{'GB', 'DE', 'FR', 'IT', 'ES', 'NL'};

const _dpdpCountries = <String>{'IN'};

PrivacyRegime privacyRegimeFor(String isoCode) {
  final iso = isoCode.toUpperCase();
  if (_dpdpCountries.contains(iso)) return PrivacyRegime.dpdp;
  if (_gdprCountries.contains(iso)) return PrivacyRegime.gdpr;
  return PrivacyRegime.generic;
}

/// Mirrors the server's `user_consents.consent_type` documented values (migration 0002).
enum ConsentType { tos, privacy, healthData, disclaimer, marketing }

String consentTypeToApi(ConsentType type) {
  switch (type) {
    case ConsentType.healthData:
      return 'health_data';
    default:
      return type.name;
  }
}

class ConsentRequirement {
  const ConsentRequirement({
    required this.consentType,
    required this.mandatory,
    required this.granular,
    required this.citation,
  });

  final ConsentType consentType;
  final bool mandatory;
  final bool granular;
  final String citation;
}

const _gdprRequirements = <ConsentRequirement>[
  ConsentRequirement(consentType: ConsentType.tos, mandatory: true, granular: false, citation: 'Contract necessity — GDPR Art. 6(1)(b)'),
  ConsentRequirement(consentType: ConsentType.privacy, mandatory: true, granular: false, citation: 'Transparency — GDPR Art. 13'),
  ConsentRequirement(consentType: ConsentType.disclaimer, mandatory: true, granular: false, citation: 'Health-information duty of care'),
  ConsentRequirement(consentType: ConsentType.healthData, mandatory: true, granular: true, citation: 'Special category data — GDPR Art. 9(2)(a), explicit consent required'),
  ConsentRequirement(consentType: ConsentType.marketing, mandatory: false, granular: true, citation: 'GDPR Art. 6(1)(a) + ePrivacy Directive Art. 13'),
];

const _dpdpRequirements = <ConsentRequirement>[
  ConsentRequirement(consentType: ConsentType.tos, mandatory: true, granular: false, citation: 'Notice-linked processing — DPDP Act 2023 Sec. 4/5'),
  ConsentRequirement(consentType: ConsentType.privacy, mandatory: true, granular: false, citation: 'Notice requirement — DPDP Act 2023 Sec. 5'),
  ConsentRequirement(consentType: ConsentType.disclaimer, mandatory: true, granular: false, citation: 'Health-information duty of care'),
  ConsentRequirement(consentType: ConsentType.healthData, mandatory: true, granular: true, citation: 'Free, specific, informed consent — DPDP Act 2023 Sec. 6'),
  ConsentRequirement(consentType: ConsentType.marketing, mandatory: false, granular: true, citation: 'Purpose limitation — DPDP Act 2023 Sec. 6(1)'),
];

const _genericRequirements = <ConsentRequirement>[
  ConsentRequirement(consentType: ConsentType.tos, mandatory: true, granular: false, citation: 'Baseline terms of service'),
  ConsentRequirement(consentType: ConsentType.privacy, mandatory: true, granular: false, citation: 'Baseline privacy notice'),
  ConsentRequirement(consentType: ConsentType.disclaimer, mandatory: true, granular: false, citation: 'Health-information duty of care'),
  ConsentRequirement(consentType: ConsentType.healthData, mandatory: false, granular: true, citation: 'Baseline opt-in for personalized health processing'),
  ConsentRequirement(consentType: ConsentType.marketing, mandatory: false, granular: true, citation: 'Baseline opt-in'),
];

List<ConsentRequirement> consentRequirementsFor(PrivacyRegime regime) {
  switch (regime) {
    case PrivacyRegime.gdpr:
      return _gdprRequirements;
    case PrivacyRegime.dpdp:
      return _dpdpRequirements;
    case PrivacyRegime.generic:
      return _genericRequirements;
  }
}
