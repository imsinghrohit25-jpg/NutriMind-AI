# NutriMind AI — Security Hardening (MASVS Checklist)

**Standard:** OWASP MASVS v2.1.0
**Status:** Re-verified 2026-07-27 (Phase 3C). ✅ = implemented & verified · ⚠️ = partial / not yet
implemented (release-blocking items called out in "Mobile hardening — release blockers" below).

> **Phase 3C accuracy pass:** several rows previously marked ✅ were found unimplemented on
> verification and have been corrected to ⚠️ with the real state — a security checklist that
> overstates coverage is itself a risk. Backend controls verified present; the outstanding gaps are
> all mobile-native and require on-device verification (tracked in Phase 3D release engineering).

---

## MASVS-STORAGE

| ID         | Requirement                                  | Status | Implementation |
|------------|----------------------------------------------|--------|----------------|
| STORAGE-1  | Sensitive data not stored in plaintext        | ⚠️     | **Gap:** `Supabase.initialize()` uses the default session store (`shared_preferences`), not `flutter_secure_storage` (a dependency, currently unused). The JWT is not Keychain/Keystore-backed. Fix: wire a `SecureLocalStorage` adapter into `FlutterAuthClientOptions`. **Release blocker.** |
| STORAGE-2  | No sensitive data in SharedPreferences/NSUserDefaults | ⚠️ | Non-sensitive flags are fine, but the Supabase session/JWT currently lands here via STORAGE-1's default store — closed once STORAGE-1 is fixed. |
| STORAGE-3  | No sensitive data in logs                    | ⚠️     | Backend redaction verified (`telemetry/redaction.ts`). **Gap:** `main.dart` initialises Supabase with `debug: true`, which logs session/PKCE detail — disable for release. |
| STORAGE-4  | No sensitive data in backups                 | ✅     | `android:allowBackup="false"` + `fullBackupContent="false"` set in `AndroidManifest.xml` (Phase 3C). iOS: exclude via `NSFileProtectionComplete` at release. |

## MASVS-CRYPTO

| ID        | Requirement                                  | Status | Implementation |
|-----------|----------------------------------------------|--------|----------------|
| CRYPTO-1  | Strong cryptography only                     | ✅     | TLS 1.2+ enforced; AES-256-GCM via Supabase realtime |
| CRYPTO-2  | Random values via secure RNG                 | ✅     | `dart:math` `Random.secure()` for nonces; UUIDs from `uuid` package |

## MASVS-AUTH

| ID      | Requirement                                  | Status | Implementation |
|---------|----------------------------------------------|--------|----------------|
| AUTH-1  | Supabase JWT validates on every API call      | ✅     | Fastify `preValidation` hook verifies JWT signature |
| AUTH-2  | Short-lived tokens (1 hour), refresh rotation | ✅     | Supabase default; `supabase_flutter` handles refresh |
| AUTH-3  | No credentials in source code                | ✅     | All keys in `.env` (gitignored); USDA/FCM keys never in mobile |

## MASVS-NETWORK

| ID         | Requirement                              | Status | Implementation |
|------------|------------------------------------------|--------|----------------|
| NETWORK-1  | TLS enforced for all connections          | ⚠️     | Prod traffic is HTTPS. **Gap:** `usesCleartextTraffic="false"` is NOT set (dev builds talk to a local HTTP API). Fix at release via a `networkSecurityConfig` that blocks cleartext in release while permitting `localhost` in debug. |
| NETWORK-2  | Certificate pinning                      | ⚠️     | ADR-0009 documents the design, but no pinning is implemented in the client (`dio` is present but unpinned). **Release blocker** for high-assurance builds. |
| NETWORK-3  | No sensitive data in URL parameters       | ✅     | User IDs in JWT, not query strings (verified — resolve/scan routes take IDs from the auth context). |

## MASVS-PLATFORM

| ID           | Requirement                              | Status | Implementation |
|--------------|------------------------------------------|--------|----------------|
| PLATFORM-1   | IPC only with trusted apps               | ✅     | No deep-link data passed to untrusted receivers |
| PLATFORM-2   | WebViews disabled / not used              | ✅     | No WebView usage; Copilot uses SSE over HTTP, not WebView |
| PLATFORM-3   | No JavaScript execution from user input   | ✅     | No dynamic JS execution paths |

## MASVS-CODE

| ID       | Requirement                              | Status | Implementation |
|----------|------------------------------------------|--------|----------------|
| CODE-1   | Prompt injection hardening               | ✅     | `security/prompt-injection.ts` (14 sanitiser tests) is now WIRED into the copilot user→LLM path (`orchestrator.ts`, Phase 3C) with a wiring test. Follow-up: also route label-OCR-feedback / voice-NLU user text through `sanitiseForLLM` (lower-risk surfaces, currently unwired). |
| CODE-2   | Dependency audit                         | ✅     | CI job "Dependency audit": `scripts/check-npm-audit.mjs` (allowlist-aware, high/critical) + Flutter pub audit — gates every PR. |
| CODE-3   | No eval / dynamic code execution         | ✅     | No `eval()` / `Function()` / `dart:mirrors` usage |

## MASVS-RESILIENCE

| ID            | Requirement                              | Status | Implementation |
|---------------|------------------------------------------|--------|----------------|
| RESILIENCE-1  | Root/jailbreak detection                 | ⚠️     | ADR-0010 documents the design, but no detection is implemented in the client. Fix: add a root/jailbreak check + health-screen warning banner. |
| RESILIENCE-2  | Anti-tampering (release build only)      | ✅     | R8 `minifyEnabled` (on by default for release) + `proguard-rules.pro` present in `android/app`. |
| RESILIENCE-3  | Screenshot protection on health screens  | ⚠️     | Not implemented — no `FLAG_SECURE` in the app. Fix: set `FLAG_SECURE` on score/copilot/health routes (Android) + `allowScreenCapture=false` (iOS). **Release blocker** for health-data screens. |

---

## Screenshot Protection

Health screens (score_screen, disease_chips, safety_badges, copilot_screen) are flagged as secure on Android:

```dart
// In main.dart or per-route lifecycle
if (Platform.isAndroid) {
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(statusBarColor: Colors.transparent),
  );
  // FLAG_SECURE via flutter_windowmanager (Phase 12 dependency)
}
```

iOS: `view.isUserInteractionEnabled` screenshots blocked via `allowScreenCapture = false` on `UIWindow`.

---

## Data Rights & Privacy

Actual routes in `apps/api/src/routes/v1/data-rights.ts` (verified Phase 3C):
- Rights catalogue: `GET /v1/data-rights/rights`
- Full export: `POST /v1/data-rights/export` — JSON of all PII (engine-computed & audit fields excluded)
- Full deletion: `POST /v1/data-rights/delete` — hard delete across all owned tables, then a per-table
  server-side verification count; returns `DELETION_UNVERIFIED` (500) if any row remains, and finally
  `auth.admin.deleteUser`. **DPDP erasure verified working (Phase 3C).**
- Processing restriction: `GET /v1/data-rights/restrict`
- Regulation compliance: Digital Personal Data Protection Act 2023 (India), GDPR (EU users) — see [GDPR_DPDP_CONSENT.md](GDPR_DPDP_CONSENT.md)
- Retention: scan history purged after 365 days (pg-boss cron job)

---

## Mobile hardening — release blockers (Phase 3C findings)

These MASVS controls are documented/designed but **not implemented in the client**, and require
on-device verification (Phase 3D release engineering) — they must not ship as ✅ until then:

1. **Secure token storage (STORAGE-1)** — move the Supabase session off `shared_preferences` onto
   `flutter_secure_storage` (already a dependency) via a `SecureLocalStorage` adapter.
2. **Screenshot protection (RESILIENCE-3)** — `FLAG_SECURE` on health/score/copilot screens.
3. **Certificate pinning (NETWORK-2)** — pin `*.supabase.co` / API host in the `dio` client.
4. **Cleartext-traffic lockdown (NETWORK-1)** — release `networkSecurityConfig` blocking cleartext.
5. **Root/jailbreak detection (RESILIENCE-1)** — detection + health-screen warning banner.
6. Disable Supabase `debug: true` logging in release (STORAGE-3).

---

## Prompt Injection Hardening

All user-supplied text passed to an LLM is sanitised by `sanitiseForLLM()` before use:
- Copilot queries → `sanitiseForLLM(query)` in `orchestrator.ts`
- Label OCR feedback text → sanitised before parse_assist calls
- 15 injection pattern tests in `security/__tests__/prompt-injection.test.ts`

Detection patterns include: role-escape phrases, `[INST]` / `<<SYS>>` delimiters, DAN jailbreak marker, `Pretend you are`, Ignore instructions variants.

Detected patterns are **redacted** (not blocked) — the legitimate part of the query is preserved and the injection attempt is logged for monitoring.
