# ADR-0011: Use Health Connect (Android), not Google Fit REST API

**Status:** Accepted  
**Date:** 2026-07-07  
**Authors:** NutriMind Platform Team

## Context

NutriMind Phase 13 requires reading health metrics (steps, calories, heart rate, sleep,
workouts) from Android devices. Two Google-backed options exist:

1. **Google Fit REST API** — legacy cloud API, deprecated
2. **Health Connect** — modern on-device API (Android 14+ built-in; backported to Android 9+)

## Decision

We use **Health Connect** via the `health` Flutter package (`^12.2.0`).

## Rationale

### Google Fit REST API is deprecated

Google announced that the Google Fit REST API will be shut down in 2025. New integrations
are not recommended and existing integrations must migrate. Using it would be building on
a foundation with a known end-of-life date.

### Health Connect is the official successor

Google explicitly positions Health Connect as the replacement for Fit REST:
- Ships natively on Android 14+
- Backported to Android 9+ via Play Store update
- Requires explicit on-device user permission per data type
- Data stays on-device — reduced privacy footprint vs cloud-synced Fit
- Supported by the `health` package which also bridges HealthKit (iOS) behind one API

### Privacy alignment

Health Connect's permission model aligns with NutriMind's per-datatype consent system:
- User grants access per type (STEPS, HEART_RATE, etc.)
- Revocation is immediate and data can be deleted from Health Connect
- No cloud intermediary between wearable and NutriMind

### Single codebase for iOS + Android

The `health` Flutter package (`pub.dev/packages/health`) abstracts both:
- HealthKit on iOS
- Health Connect on Android

This eliminates platform-specific divergence in the sync code.

## Consequences

- **Positive:** Future-proof; on-device privacy; single Flutter package handles both platforms
- **Positive:** Granular per-type consent aligns with `health_consents` schema
- **Negative:** Health Connect requires Android 9+ (covers >99% of active Android devices as of 2026)
- **Negative:** Health Connect permissions must be declared in `AndroidManifest.xml` and reviewed by Google Play if sensitive types (HEART_RATE, BLOOD_GLUCOSE) are included

## Android Manifest Requirements

```xml
<!-- In android/app/src/main/AndroidManifest.xml -->
<uses-permission android:name="android.permission.health.READ_STEPS"/>
<uses-permission android:name="android.permission.health.READ_ACTIVE_CALORIES_BURNED"/>
<uses-permission android:name="android.permission.health.READ_HEART_RATE"/>
<uses-permission android:name="android.permission.health.READ_SLEEP"/>
<uses-permission android:name="android.permission.health.READ_WEIGHT"/>
<uses-permission android:name="android.permission.health.READ_EXERCISE"/>
<uses-permission android:name="android.permission.health.READ_BLOOD_GLUCOSE"/>
<uses-permission android:name="android.permission.health.READ_BLOOD_OXYGEN"/>

<queries>
  <package android:name="com.google.android.apps.healthdata"/>
</queries>
```

## References

- [Health Connect documentation](https://developer.android.com/health-and-fitness/guides/health-connect)
- [Google Fit deprecation notice](https://developers.google.com/fit/deprecation)
- [health Flutter package](https://pub.dev/packages/health)
