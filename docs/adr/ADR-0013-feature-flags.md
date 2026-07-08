# ADR-0013 — Feature Flag Service for Global Enterprise Edition

**Date:** 2026-07-08  
**Status:** Accepted  
**Deciders:** Principal Architect, Backend Lead  

---

## Context

The Global Enterprise Edition introduces many new capabilities (country-aware UI, new nutrition standards, RTL layout, regional food databases, global allergen regimes). These must ship behind feature flags so:

1. **Existing India users are not disrupted** — new global features default OFF for `country_code = 'IN'` until explicitly enabled.
2. **Canary rollout** — new features can be enabled for a percentage of users or specific country cohorts.
3. **Kill switch** — any feature can be disabled remotely without a code deploy.

---

## Decision

Implement a **Supabase-backed feature flag service** with the following design:

### Database (`feature_flags` table)
```sql
CREATE TABLE feature_flags (
  key         text NOT NULL,
  enabled     boolean NOT NULL DEFAULT false,
  country_code text,         -- NULL = all countries; 'IN' = India only; etc.
  rollout_pct  integer DEFAULT 100, -- % of eligible users
  description text,
  updated_at  timestamptz DEFAULT now(),
  PRIMARY KEY (key, COALESCE(country_code, ''))
);
```

### API endpoint
`GET /api/v1/flags` — returns resolved flags for the requesting user's country context.

### Dart SDK (`packages/core/lib/feature_flags/`)
- `FeatureFlagService` fetches at app startup + re-fetches on country change
- Local defaults: all new global flags default to `false`
- Offline: last-known values from SharedPreferences; falls back to defaults
- Type-safe constants: `NutriMindFlags.kGlobalCountryEngine`, etc.

### Naming Convention
All Phase 1–10 flags are namespaced: `global.{phase}.{feature}`:
- `global.p1.country_engine` — Country Intelligence Engine
- `global.p2.localization_rtl` — RTL layout support
- `global.p2.tier_b_languages` — Tier B language pack loading
- `global.p3.unified_food_schema` — Global food DB schema
- `global.p4.multi_standard_rules` — Multi-country nutrition rule packs
- `global.p5.grocery_provider_chain` — Global grocery provider abstraction
- `global.p6.cloud_ocr_fallback` — Cloud Vision API for unsupported scripts
- `global.p7.multi_region_routing` — Edge routing + residency
- `global.p8.gdpr_consent_flow` — GDPR-specific consent
- `global.p9.incremental_regional_sync` — Regional device packs
- `global.p10.country_onboarding_v2` — New country onboarding flow

---

## Alternatives Considered

| Option | Rejected Reason |
|--------|----------------|
| Firebase Remote Config | Adds Firebase dependency; existing stack is Supabase |
| LaunchDarkly / Statsig | Cost; third-party dependency for a feature that's straightforward to own |
| Hardcoded constants | Cannot toggle without code deploy; violates kill-switch requirement |
| Supabase Realtime for live flag updates | Overkill for Phase 0; can add in Phase 9 if needed |

---

## Consequences

- Feature flag table is seeded in Phase 0; all existing features implicitly have `enabled=true` (no flag = always on)
- New global features start with `enabled=false`
- Flag resolution runs at session start, not on every API call (performance)
- CI: integration tests run with `NutriMindFlags.allEnabled()` to test all code paths
