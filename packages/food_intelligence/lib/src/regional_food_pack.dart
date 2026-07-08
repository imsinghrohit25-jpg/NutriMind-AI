/// Descriptor for a downloadable regional food composition data pack.
/// The pack enables offline food lookup for a specific country/region.
/// Download URL points to our CDN-hosted pack (populated in Phase 9 — Offline).
class RegionalFoodPack {
  const RegionalFoodPack({
    required this.packId,
    required this.countryCode,
    required this.dataSourceId,
    required this.displayName,
    required this.itemCount,
    required this.sizeKb,
    required this.downloadUrl,
    required this.datasetVersion,
    required this.lastUpdated,
    required this.isDownloaded,
  });

  /// Unique pack identifier, e.g. 'cofid_gb_2021', 'ifct_in_2017'.
  final String packId;

  /// ISO-3166 country code this pack covers.
  final String countryCode;

  /// data_sources.id value (matches API/DB).
  final String dataSourceId;

  /// Human-readable name shown in UI.
  final String displayName;

  /// Approximate number of food items in the pack.
  final int itemCount;

  /// Compressed size in kilobytes.
  final int sizeKb;

  /// CDN URL for downloading the pack (JSON format, compressed).
  final String downloadUrl;

  /// Dataset version string (e.g. '2021', '2017').
  final String datasetVersion;

  final DateTime lastUpdated;

  /// Whether this pack is currently downloaded and available offline.
  final bool isDownloaded;

  RegionalFoodPack copyWith({bool? isDownloaded}) => RegionalFoodPack(
    packId: packId, countryCode: countryCode, dataSourceId: dataSourceId,
    displayName: displayName, itemCount: itemCount, sizeKb: sizeKb,
    downloadUrl: downloadUrl, datasetVersion: datasetVersion,
    lastUpdated: lastUpdated, isDownloaded: isDownloaded ?? this.isDownloaded,
  );

  Map<String, dynamic> toJson() => {
    'packId': packId, 'countryCode': countryCode, 'dataSourceId': dataSourceId,
    'displayName': displayName, 'itemCount': itemCount, 'sizeKb': sizeKb,
    'downloadUrl': downloadUrl, 'datasetVersion': datasetVersion,
    'lastUpdated': lastUpdated.toIso8601String(), 'isDownloaded': isDownloaded,
  };

  factory RegionalFoodPack.fromJson(Map<String, dynamic> j) => RegionalFoodPack(
    packId:         j['packId'] as String,
    countryCode:    j['countryCode'] as String,
    dataSourceId:   j['dataSourceId'] as String,
    displayName:    j['displayName'] as String,
    itemCount:      j['itemCount'] as int,
    sizeKb:         j['sizeKb'] as int,
    downloadUrl:    j['downloadUrl'] as String,
    datasetVersion: j['datasetVersion'] as String,
    lastUpdated:    DateTime.parse(j['lastUpdated'] as String),
    isDownloaded:   j['isDownloaded'] as bool? ?? false,
  );
}

/// Known regional packs, populated at build time.
/// Download URLs are placeholders until Phase 9 (CDN provisioning).
final List<RegionalFoodPack> kKnownRegionalPacks = [
  RegionalFoodPack(
    packId: 'ifct_in_2017', countryCode: 'IN', dataSourceId: 'ifct_2017',
    displayName: 'India food pack (IFCT 2017)',
    itemCount: 528, sizeKb: 320,
    downloadUrl: 'https://cdn.nutrimind.app/packs/ifct_in_2017.json.gz',
    datasetVersion: '2017', lastUpdated: DateTime.utc(2017, 1, 1), isDownloaded: false,
  ),
  RegionalFoodPack(
    packId: 'cofid_gb_2021', countryCode: 'GB', dataSourceId: 'cofid_2021',
    displayName: 'UK food pack (CoFID 2021)',
    itemCount: 3000, sizeKb: 450,
    downloadUrl: 'https://cdn.nutrimind.app/packs/cofid_gb_2021.json.gz',
    datasetVersion: '2021', lastUpdated: DateTime.utc(2021, 1, 1), isDownloaded: false,
  ),
  RegionalFoodPack(
    packId: 'usda_us_2024', countryCode: 'US', dataSourceId: 'usda_fdc',
    displayName: 'US food pack (USDA FDC 2024)',
    itemCount: 8789, sizeKb: 1200,
    downloadUrl: 'https://cdn.nutrimind.app/packs/usda_us_2024.json.gz',
    datasetVersion: '2024', lastUpdated: DateTime.utc(2024, 1, 1), isDownloaded: false,
  ),
];
