import 'country_profile.dart';

/// AWS-style region identifiers, matching Supabase's supported project regions — mirrors
/// `DataRegion` in `apps/api/src/region/types.ts` (Phase 7, `global.p7.multi_region_routing`).
enum DataRegion { apSouth1, euWest1, usEast1 }

/// Display metadata for a [DataRegion]. Whether a region is actually provisioned today (`live`)
/// must stay identical to the server's `REGION_REGISTRY` in `apps/api/src/region/registry.ts`.
class DataRegionInfo {
  const DataRegionInfo({required this.id, required this.displayName, required this.live});

  final DataRegion id;
  final String displayName;
  final bool live;
}

const _regionInfo = <DataRegion, DataRegionInfo>{
  DataRegion.apSouth1: DataRegionInfo(
    id: DataRegion.apSouth1,
    displayName: 'Asia Pacific (Mumbai)',
    live: true,
  ),
  DataRegion.euWest1: DataRegionInfo(
    id: DataRegion.euWest1,
    displayName: 'Europe (Ireland)',
    live: false,
  ),
  DataRegion.usEast1: DataRegionInfo(
    id: DataRegion.usEast1,
    displayName: 'US East (N. Virginia)',
    live: false,
  ),
};

DataRegionInfo dataRegionInfo(DataRegion region) => _regionInfo[region]!;

/// The one region that actually has a provisioned deployment today — must stay identical to
/// the server's `ACTIVE_REGION`.
const activeDataRegion = DataRegion.apSouth1;

/// EU/EEA member states in `CountryRegistry`, plus GB (UK GDPR mirrors EU GDPR post-Brexit) —
/// GDPR Regulation (EU) 2016/679 residency/transfer rules apply. Must stay identical to the
/// server's `EU_UK_GDPR` set.
const _euUkGdpr = <String>{'GB', 'DE', 'FR', 'IT', 'ES', 'NL'};

/// North America — nearest provisioned-region target once `usEast1` exists.
const _northAmerica = <String>{'US', 'CA', 'MX'};

/// Which region [isoCode]'s traffic/data should target (residency policy + latency). Must stay
/// identical to the server's `targetRegionFor()`.
DataRegion targetRegionFor(String isoCode) {
  final iso = isoCode.toUpperCase();
  if (_euUkGdpr.contains(iso)) return DataRegion.euWest1;
  if (_northAmerica.contains(iso)) return DataRegion.usEast1;
  return DataRegion.apSouth1;
}

/// True when [isoCode] has a legal (GDPR/UK GDPR) requirement, not just a latency preference.
bool residencyRequiredFor(String isoCode) => _euUkGdpr.contains(isoCode.toUpperCase());

/// Resolved data-region decision for a country — mirrors the server's `DataRegionResolution`.
/// `active` is always [activeDataRegion] today; `residencySatisfied` is false whenever a
/// residency-required country's `target` isn't the live region yet — this never claims
/// compliance the client can't actually deliver (see ADR-0020).
class DataRegionResolution {
  const DataRegionResolution({
    required this.target,
    required this.active,
    required this.residencyRequired,
    required this.residencySatisfied,
  });

  final DataRegion target;
  final DataRegion active;
  final bool residencyRequired;
  final bool residencySatisfied;
}

DataRegionResolution resolveDataRegion(String isoCode) {
  final target = targetRegionFor(isoCode);
  final residencyRequired = residencyRequiredFor(isoCode);
  return DataRegionResolution(
    target: target,
    active: activeDataRegion,
    residencyRequired: residencyRequired,
    residencySatisfied: activeDataRegion == target,
  );
}

/// Convenience overload resolving directly from a [CountryProfile].
DataRegionResolution resolveDataRegionForProfile(CountryProfile profile) =>
    resolveDataRegion(profile.isoCode);
