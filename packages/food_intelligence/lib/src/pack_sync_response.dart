/// Mirrors the server's `PackSyncResult`/`PackSyncItem`
/// (`apps/api/src/packs/types.ts`, Phase 9 `global.p9.incremental_regional_sync`).
class PackSyncItem {
  const PackSyncItem({required this.sourceId, required this.name, required this.nutrition});

  final String sourceId;
  final String name;
  final Map<String, dynamic> nutrition;
}

class PackSyncResponse {
  const PackSyncResponse({
    required this.packId,
    required this.datasetVersion,
    required this.upToDate,
    required this.items,
  });

  final String packId;
  final String datasetVersion;

  /// True when nothing changed since the client's cached version, OR the server dataset isn't
  /// available at all — `items` is empty in both cases. Callers that need to distinguish
  /// "nothing new" from "no data exists" should check the pack's `available` flag from the
  /// manifest separately.
  final bool upToDate;
  final List<PackSyncItem> items;
}
