# GDPR/DPDP Consent & DSR Endpoints — Phase 8 Reference

**Effective:** 2026-07-08 · **Phase:** 8 (Global Enterprise Edition)
**Flags:** `global.p8.gdpr_consent_flow`, `global.p8.dpdp_consent_flow`, `global.p8.dsr_endpoints`
**Related:** [ADR-0021](adr/ADR-0021-gdpr-dpdp-consent-dsr.md),
[SECURITY.md](SECURITY.md#data-rights--privacy), [COMPLIANCE.md](COMPLIANCE.md)

## Privacy regime by country

| Regime | Countries | Basis |
|---|---|---|
| `DPDP` | IN | Digital Personal Data Protection Act 2023 |
| `GDPR` | GB, DE, FR, IT, ES, NL | Regulation (EU) 2016/679 / UK GDPR (Data Protection Act 2018) |
| `GENERIC` | everyone else | Baseline — no specific statute assumed |

`GET /v1/privacy/regime` resolves the caller's regime from `request.country` and returns
`consentRequirements`: which of `tos | privacy | health_data | disclaimer | marketing` are
mandatory, and which must be requested/withdrawable independently (`granular`). Both GDPR and
DPDP require `health_data` consent to be explicit and granular (GDPR Art. 9(2)(a); DPDP Sec. 6);
the GENERIC baseline treats it as optional.

## Consent endpoints

| Endpoint | Purpose |
|---|---|
| `GET /v1/privacy/regime` | Resolved regime + requirements (no auth required) |
| `GET /v1/privacy/consent` | Current status per consent type (latest event wins) |
| `POST /v1/privacy/consent` | Record a grant |
| `POST /v1/privacy/consent/withdraw` | Record a withdrawal — as easy as granting (Art. 7(3)/Sec. 6(4)) |

Backed by `user_consents` (migration 0002, extended by 0021 with `granted`): append-only, one row
per event. A version can be granted once and withdrawn once (`UNIQUE(user_id, consent_type,
version, granted)`); withdrawing an already-withdrawn version, or re-granting, needs a new
`version` string.

## DSR (Data Subject Rights) endpoints

| Right | Endpoint | Statute |
|---|---|---|
| Access / portability | `POST /v1/data-rights/export` | GDPR Art. 15/20, DPDP Sec. 11 |
| Erasure | `POST /v1/data-rights/delete` | GDPR Art. 17, DPDP Sec. 12 |
| Rectification | `PATCH /v1/data-rights/rectify` | GDPR Art. 16, DPDP Sec. 12 |
| Restriction | `POST /v1/data-rights/restrict`, `POST .../restrict/lift`, `GET .../restrict` | GDPR Art. 18, DPDP Sec. 12 |
| Rights summary | `GET /v1/data-rights/rights` | — |
| Consent withdrawal | `POST /v1/privacy/consent/withdraw` | GDPR Art. 7(3), DPDP Sec. 6(4) |

Export/delete cover: `scan_history_embeddings`, `copilot_conversations`, `grocery_cart_sessions`,
`recommendations`, `meal_logs`, `push_tokens`, `push_preferences`, `scans`, `health_scores`,
`weekly_reports`, `household_members`, `users_profiles`. FK-cascade children (`scan_images`,
`member_safety_evaluations`, `grocery_cart_items`, `copilot_messages`) are removed transitively
when their parent row is deleted. `user_consents` and `audit_log`/`llm_call_log` are **not**
deleted — retained under the legal-obligation/defense-of-claims exception (Art. 17(3)(b)).

Rectifiable `users_profiles` fields: `display_name`, `age_years`, `biological_sex`, `height_cm`,
`weight_kg`, `activity_level`, `goal`, `diet_type`, `conditions`, `allergens`,
`preferred_language`. Engine-computed fields (`tdee_kcal`, `macro_*`) and system state
(`onboarding_complete`) are not rectifiable through this endpoint — they aren't "personal data
the user asserts is inaccurate."

## Processing restriction — recorded, not yet enforced

`POST /v1/data-rights/restrict` writes a real, queryable, auditable row to
`processing_restrictions` (migration 0022). **No consumer checks this flag yet** — the score
engine, copilot, and job pipelines all run unchanged regardless of restriction status. The API
response says so explicitly rather than implying a guarantee that doesn't exist.

## Known gaps (tracked, not blocking Phase 8)

- `processing_restrictions` has no enforcement consumer — no owner/timeline.
- **Found during this phase, out of scope to fix:** `routes/v1/index.ts` only registers 7 of 16
  route files. `family.ts`, `restaurant.ts`, `planner.ts`, `pantry.ts`, `biomarker.ts`,
  `health-data.ts`, and `voice.ts` all exist with real handlers but are never reachable in the
  running API. `data-rights.ts` (this phase) and `privacy.ts` are now registered; the other six
  are not — a materially larger issue than anything in this phase, worth a dedicated pass.
- `voice.ts` additionally hardcodes `/api/v1/voice/parse` rather than the `/v1/...` prefix every
  *registered* route actually resolves to — will need the same fix `data-rights.ts` got here.
- Non-India GDPR/DPDP consent-requirement citations are structural approximations pending
  licensed privacy-counsel review before real users rely on them (same caveat as every prior
  non-India regulatory pack — nutrition standards, allergen regimes).
