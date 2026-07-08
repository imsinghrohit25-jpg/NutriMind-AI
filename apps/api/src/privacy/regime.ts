// Privacy regime resolution — Phase 8 (`global.p8.gdpr_consent_flow`, `dpdp_consent_flow`).
// Determines which consent framework applies to a country, and the structured consent
// requirements that framework imposes (which purposes need consent at all, and which must be
// requested/withdrawable independently of the others). These are structural citations of real,
// well-known statute provisions — not generated legal advice — same "single-pass approximation,
// licensed review required before enabling for real users" caveat as ADR-0017's non-India
// nutrition-standard packs.

export type PrivacyRegime = 'GDPR' | 'DPDP' | 'GENERIC';

// Same 6-country EU/UK-GDPR set as Phase 7's `region/registry.ts` EU_UK_GDPR — GDPR
// Regulation (EU) 2016/679; UK GDPR mirrors it post-Brexit via the Data Protection Act 2018.
const GDPR_COUNTRIES: ReadonlySet<string> = new Set(['GB', 'DE', 'FR', 'IT', 'ES', 'NL']);

// Digital Personal Data Protection Act 2023 — India.
const DPDP_COUNTRIES: ReadonlySet<string> = new Set(['IN']);

export function privacyRegimeFor(isoCode: string): PrivacyRegime {
  const iso = isoCode.toUpperCase();
  if (DPDP_COUNTRIES.has(iso)) return 'DPDP';
  if (GDPR_COUNTRIES.has(iso)) return 'GDPR';
  return 'GENERIC';
}

// Mirrors `user_consents.consent_type`'s documented values (migration 0002; `ai_personalization`
// added Phase 11, §12.1 — memory is personal data subject to consent like any other purpose,
// and it's optional/independently withdrawable, never bundled with mandatory ToS/privacy
// consent — turning it off must not degrade core app functionality, only personalization).
export type ConsentType = 'tos' | 'privacy' | 'health_data' | 'disclaimer' | 'marketing' | 'ai_personalization';

export interface ConsentRequirement {
  consentType: ConsentType;
  /** Must be granted to use the core app at all. */
  mandatory: boolean;
  /** Must be requested and withdrawable independently of other purposes (not bundled). */
  granular: boolean;
  /** Real statute provision this requirement is structurally derived from. */
  citation: string;
}

const GDPR_REQUIREMENTS: readonly ConsentRequirement[] = [
  { consentType: 'tos', mandatory: true, granular: false, citation: 'Contract necessity — GDPR Art. 6(1)(b)' },
  { consentType: 'privacy', mandatory: true, granular: false, citation: 'Transparency — GDPR Art. 13' },
  { consentType: 'disclaimer', mandatory: true, granular: false, citation: 'Health-information duty of care' },
  { consentType: 'health_data', mandatory: true, granular: true, citation: 'Special category data — GDPR Art. 9(2)(a), explicit consent required' },
  { consentType: 'marketing', mandatory: false, granular: true, citation: 'GDPR Art. 6(1)(a) + ePrivacy Directive Art. 13' },
  { consentType: 'ai_personalization', mandatory: false, granular: true, citation: 'Profiling — GDPR Art. 22 / Art. 6(1)(a), explicit opt-in required for the AI Memory System' },
];

const DPDP_REQUIREMENTS: readonly ConsentRequirement[] = [
  { consentType: 'tos', mandatory: true, granular: false, citation: 'Notice-linked processing — DPDP Act 2023 Sec. 4/5' },
  { consentType: 'privacy', mandatory: true, granular: false, citation: 'Notice requirement — DPDP Act 2023 Sec. 5' },
  { consentType: 'disclaimer', mandatory: true, granular: false, citation: 'Health-information duty of care' },
  { consentType: 'health_data', mandatory: true, granular: true, citation: 'Free, specific, informed consent — DPDP Act 2023 Sec. 6' },
  { consentType: 'marketing', mandatory: false, granular: true, citation: 'Purpose limitation — DPDP Act 2023 Sec. 6(1)' },
  { consentType: 'ai_personalization', mandatory: false, granular: true, citation: 'Free, specific, informed consent for the AI Memory System — DPDP Act 2023 Sec. 6' },
];

const GENERIC_REQUIREMENTS: readonly ConsentRequirement[] = [
  { consentType: 'tos', mandatory: true, granular: false, citation: 'Baseline terms of service' },
  { consentType: 'privacy', mandatory: true, granular: false, citation: 'Baseline privacy notice' },
  { consentType: 'disclaimer', mandatory: true, granular: false, citation: 'Health-information duty of care' },
  { consentType: 'health_data', mandatory: false, granular: true, citation: 'Baseline opt-in for personalized health processing' },
  { consentType: 'marketing', mandatory: false, granular: true, citation: 'Baseline opt-in' },
  { consentType: 'ai_personalization', mandatory: false, granular: true, citation: 'Baseline opt-in for the AI Memory System' },
];

export function consentRequirementsFor(regime: PrivacyRegime): readonly ConsentRequirement[] {
  switch (regime) {
    case 'GDPR': return GDPR_REQUIREMENTS;
    case 'DPDP': return DPDP_REQUIREMENTS;
    default: return GENERIC_REQUIREMENTS;
  }
}

export const ALL_CONSENT_TYPES: readonly ConsentType[] = ['tos', 'privacy', 'health_data', 'disclaimer', 'marketing', 'ai_personalization'];
