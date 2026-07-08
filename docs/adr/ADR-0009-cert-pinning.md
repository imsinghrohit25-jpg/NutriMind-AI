# ADR-0009 — Certificate Pinning Strategy

**Status:** Accepted  
**Date:** 2026-07-07  
**Deciders:** NutriMind AI project

## Context

NutriMind transmits health-sensitive user data (scan history, meal logs, allergen profiles) over HTTPS. Certificate pinning provides a defence-in-depth layer against MITM attacks that could bypass OS certificate trust stores (e.g., user-installed CA roots in enterprise MDM scenarios, or malicious root CAs on compromised devices).

## Decision

Pin the TLS certificate for both endpoints:
- `*.supabase.co` (auth, realtime, storage)
- `api.nutrimind.app` (Fastify API)

**Android:** Network Security Configuration (`res/xml/network_security_config.xml`) with `<pin-set>` containing the leaf certificate SHA-256 and its backup pin (intermediate CA).

**iOS:** `URLSessionDelegate` with `SecTrustEvaluateWithError` + pinned certificate hash. Implemented via `flutter_certificate_pinning` (Phase 12 dependency).

## Pins

Pins are stored as SHA-256 SPKI hashes (not raw cert pins — this survives cert renewal as long as the key pair is reused):

```
# *.supabase.co
sha256/BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=  # leaf (placeholder — replace with real pin)
sha256/CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC=  # backup (DigiCert root)

# api.nutrimind.app
sha256/DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD=  # leaf (placeholder)
sha256/EEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE=  # backup (Let's Encrypt ISRG Root X1)
```

Placeholders must be replaced with real pins before the first production build (Phase 12).

## Pin Rotation Policy

- Certificate renews 30 days before expiry (automated via Let's Encrypt / Supabase)
- New pin deployed in backend 2 weeks before rotation
- App update with new pin pushed via staged rollout 1 week before rotation
- Old pin retained in `<pin-set>` for 30 days after rotation

## Consequences

- **Positive:** MITM attack surface eliminated for app↔server communications
- **Negative:** Pin rotation requires coordinated cert renewal + app release
- **Mitigation:** Backup pin (intermediate CA) prevents lockout if leaf cert changes unexpectedly
- **Out of scope:** VPN bypass and OS-level MITM (root-jailbreak detection is a separate ADR)
