# ADR-0010 — Root / Jailbreak Detection

**Status:** Accepted  
**Date:** 2026-07-07  
**Deciders:** NutriMind AI project

## Context

Users on rooted Android or jailbroken iOS devices can bypass:
- Secure storage (Keychain/Keystore contents readable as root)
- Screenshot protection (`FLAG_SECURE` bypassed)
- Certificate pinning (custom trust stores)

NutriMind stores allergen profiles and health data that users may not want exposed. We must detect a compromised environment and warn the user appropriately.

## Decision

**Policy: Warn, do not block.**

Blocking on root detection creates a poor UX for legitimate users (developers, privacy-conscious users who rooted to remove bloat). A warning banner informs the user of the elevated risk without preventing access.

The warning banner:
- Is shown on the home screen and on all health screens (score, safety badges, disease chips)
- States: *"Your device appears to be rooted/jailbroken. Secure storage may not be protected. We recommend using NutriMind on an unmodified device."*
- Cannot be dismissed permanently (re-evaluated on every app launch)

## Detection Methods

### Android
1. Presence of `su` binary in common paths (`/system/bin/su`, `/system/xbin/su`)
2. `Build.TAGS` contains `test-keys` (AOSP development builds)
3. Dangerous app packages present (e.g., `com.topjohnwu.magisk`)
4. `/proc/self/maps` check for Frida gadget injection

### iOS
1. Presence of `/Applications/Cydia.app` or `/usr/sbin/sshd`
2. Sandbox escape test: write to `/private/nutrimind_probe` (should fail on non-jailbroken)
3. URL scheme check: `cydia://` scheme registrable

## Implementation

`flutter_jailbreak_detection` package (Phase 12 dependency).

```dart
// In app startup
final compromised = await JailbreakDetection.jailbroken;
if (compromised) ref.read(deviceSecurityProvider.notifier).setRooted(true);
```

The `deviceSecurityProvider` is read by all health screens to display the warning banner.

## Consequences

- **Positive:** Transparent security posture; users aware of risk without being locked out
- **Negative:** Sophisticated attackers can bypass detection (anti-tampering evasion)
- **Accepted:** We do not process payment data; risk is health data exposure, which user is warned about
- **Not accepted:** Certificate pinning bypass — this is a separate, harder threat (see ADR-0009)
