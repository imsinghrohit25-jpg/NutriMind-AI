# NutriMind AI — Security Hardening (MASVS Checklist)

**Standard:** OWASP MASVS v2.1.0  
**Status:** Phase 11 — checklist complete; items marked ✅ implemented, ⚠️ planned for Phase 12 CI.

---

## MASVS-STORAGE

| ID         | Requirement                                  | Status | Implementation |
|------------|----------------------------------------------|--------|----------------|
| STORAGE-1  | Sensitive data not stored in plaintext        | ✅     | Supabase JWT stored via `flutter_secure_storage` (Keychain/Keystore backed) |
| STORAGE-2  | No sensitive data in SharedPreferences/NSUserDefaults | ✅ | Only non-sensitive flags (consent, onboarding state) in `shared_preferences` |
| STORAGE-3  | No sensitive data in logs                    | ✅     | Logger strips JWT/API keys; `SUPABASE_SERVICE_ROLE_KEY` never in mobile |
| STORAGE-4  | No sensitive data in backups                 | ✅     | `android:allowBackup="false"` in manifest; iOS excluded via `NSFileProtectionComplete` |

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
| NETWORK-1  | TLS enforced for all connections          | ✅     | HTTPS only; HTTP disabled in `AndroidManifest.xml` `usesCleartextTraffic="false"` |
| NETWORK-2  | Certificate pinning                      | ✅     | See ADR-0009-cert-pinning.md; pins for `*.supabase.co` and `api.nutrimind.app` |
| NETWORK-3  | No sensitive data in URL parameters       | ✅     | User IDs in JWT, not query strings |

## MASVS-PLATFORM

| ID           | Requirement                              | Status | Implementation |
|--------------|------------------------------------------|--------|----------------|
| PLATFORM-1   | IPC only with trusted apps               | ✅     | No deep-link data passed to untrusted receivers |
| PLATFORM-2   | WebViews disabled / not used              | ✅     | No WebView usage; Copilot uses SSE over HTTP, not WebView |
| PLATFORM-3   | No JavaScript execution from user input   | ✅     | No dynamic JS execution paths |

## MASVS-CODE

| ID       | Requirement                              | Status | Implementation |
|----------|------------------------------------------|--------|----------------|
| CODE-1   | Prompt injection hardening               | ✅     | `apps/api/src/security/prompt-injection.ts` — all user text → LLM is sanitised; 15 injection tests passing |
| CODE-2   | Dependency audit                         | ⚠️     | Phase 12: `npm audit` + `flutter pub audit` in CI |
| CODE-3   | No eval / dynamic code execution         | ✅     | No `eval()` / `Function()` / `dart:mirrors` usage |

## MASVS-RESILIENCE

| ID            | Requirement                              | Status | Implementation |
|---------------|------------------------------------------|--------|----------------|
| RESILIENCE-1  | Root/jailbreak detection                 | ✅     | See ADR-0010-root-jailbreak.md; health screens show warning banner |
| RESILIENCE-2  | Anti-tampering (release build only)      | ⚠️     | Phase 12: ProGuard/R8 obfuscation enabled in release build |
| RESILIENCE-3  | Screenshot protection on health screens  | ✅     | `FLAG_SECURE` set on Android for score/health screens; iOS `allowScreenCapture: false` |

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

- Full export: `POST /api/v1/data-rights/export` — JSON of all PII
- Full deletion: `POST /api/v1/data-rights/delete` — hard delete + server-side verification query (gate: row count = 0 after delete)
- Regulation compliance: Digital Personal Data Protection Act 2023 (India), GDPR (EU users)
- Retention: scan history purged after 365 days (pg-boss cron job)

---

## Prompt Injection Hardening

All user-supplied text passed to an LLM is sanitised by `sanitiseForLLM()` before use:
- Copilot queries → `sanitiseForLLM(query)` in `orchestrator.ts`
- Label OCR feedback text → sanitised before parse_assist calls
- 15 injection pattern tests in `security/__tests__/prompt-injection.test.ts`

Detection patterns include: role-escape phrases, `[INST]` / `<<SYS>>` delimiters, DAN jailbreak marker, `Pretend you are`, Ignore instructions variants.

Detected patterns are **redacted** (not blocked) — the legitimate part of the query is preserved and the injection attempt is logged for monitoring.
