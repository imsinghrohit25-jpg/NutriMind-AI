/// Descriptor for a downloadable regional food composition data pack.
/// The pack enables offline food lookup for a specific country/region.
///
/// Phase 9 (`global.p9.incremental_regional_sync`) implements the actual sync mechanics this
/// class was a placeholder for — see `PackSyncClient`. `downloadUrl` originally pointed at a
/// `cdn.nutrimind.app` host that was never provisioned (no CDN exists); packs are synced
/// through the API itself (`GET /v1/packs/:packId/sync`), not downloaded from a separate CDN,
/// so that field is gone. `sourceId` is now the real database-owning table, either `ifct_2017`
/// or `cofid_2021` — matches the server's `packs/registry.ts` `PACK_REGISTRY`.
class RegionalFoodPack {
  const RegionalFoodPack({
    required this.packId,
    required this.countryCode,
    required this.dataSourceId,
    required this.displayName,
    required this.itemCount,
    required this.datasetVersion,
    required this.available,
    this.syncedVersion,
  });

  /// Unique pack identifier, e.g. 'cofid_gb_2021', 'ifct_in_2017'. Matches the server's
  /// `packs/registry.ts` `PACK_REGISTRY` exactly.
  final String packId;

  /// ISO-3166 country code this pack covers.
  final String countryCode;

  /// data_sources.id value (matches API/DB).
  final String dataSourceId;

  /// Human-readable name shown in UI.
  final String displayName;

  /// Real item count reported by the server (0 when the dataset isn't loaded server-side —
  /// never a placeholder estimate).
  final int itemCount;

  /// Current server-side dataset version, e.g. '2017'.
  final String datasetVersion;

  /// Whether the server actually has this dataset loaded. A pack can be listed
  /// (`PACK_REGISTRY` knows about it) without being `available` (licensed dataset file not
  /// placed — see IfctLoader/CofidLoader's graceful degradation).
  final bool available;

  /// The `datasetVersion` this device last synced, if any. `null` means never synced.
  final String? syncedVersion;

  /// Whether a sync would actually fetch new data (server has a newer version than this
  /// device's last sync, and the server dataset is available at all).
  bool get needsSync => available && syncedVersion != datasetVersion;

  RegionalFoodPack copyWith({String? syncedVersion}) => RegionalFoodPack(
    packId: packId, countryCode: countryCode, dataSourceId: dataSourceId,
    displayName: displayName, itemCount: itemCount, datasetVersion: datasetVersion,
    available: available, syncedVersion: syncedVersion ?? this.syncedVersion,
  );

  factory RegionalFoodPack.fromManifestJson(Map<String, dynamic> j, {String? syncedVersion}) =>
      RegionalFoodPack(
        packId:         j['packId'] as String,
        countryCode:    j['countryCode'] as String,
        dataSourceId:   j['dataSourceId'] as String,
        displayName:    j['displayName'] as String,
        itemCount:      j['itemCount'] as int,
        datasetVersion: j['datasetVersion'] as String,
        available:      j['available'] as bool,
        syncedVersion:  syncedVersion,
      );
}
