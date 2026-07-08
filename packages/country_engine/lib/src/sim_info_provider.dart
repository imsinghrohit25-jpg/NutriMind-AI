// SIM Info Provider — abstract interface for MCC detection.
// The real implementation requires platform-specific telephony APIs
// and the READ_PHONE_STATE permission on Android.
// Phase 6 will implement PlatformSimInfoProvider using a native plugin.

/// Returns the Mobile Country Code of the primary SIM, or null.
abstract class SimInfoProvider {
  const SimInfoProvider();
  Future<String?> getMcc();
}

/// No-op implementation: used in Phase 1 and on platforms without telephony.
class NullSimInfoProvider implements SimInfoProvider {
  const NullSimInfoProvider();

  @override
  Future<String?> getMcc() async => null;
}
