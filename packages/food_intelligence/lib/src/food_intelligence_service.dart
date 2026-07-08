import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:nutrimind_country_engine/nutrimind_country_engine.dart';

import 'food_profile.dart';
import 'food_data_source.dart';
import 'regional_food_pack.dart';
import 'pack_sync_response.dart';

/// Result of a food resolution attempt.
class FoodResolutionResult {
  const FoodResolutionResult({
    required this.profile,
    required this.resolvedBy,
    required this.country,
  });

  final FoodProfile? profile;
  final FoodDataSource resolvedBy;
  final String country; // ISO code

  bool get found => profile != null;
}

/// Thin Dart service — delegates food resolution to the API.
/// The country-aware waterfall runs on the server side; this client
/// sends `x-user-country` so the server picks the right source chain.
///
/// Feature flag `global.p3.unified_food_schema` controls server-side
/// country routing — the client is transparent to this flag.
class FoodIntelligenceService {
  FoodIntelligenceService({required this.dio, required this.baseUrl});

  final Dio dio;
  final String baseUrl;

  /// Resolve a food item by barcode. Returns null if not found.
  Future<FoodResolutionResult> resolveBarcode(
    String barcode,
    CountryProfile country,
  ) async {
    final resp = await dio.post(
      '$baseUrl/v1/resolve/barcode',
      data: {'barcode': barcode},
      options: Options(headers: {'x-user-country': country.isoCode}),
    );
    return _parseResolveResponse(resp.data as Map<String, dynamic>, country);
  }

  /// Resolve a food item by name. Returns null if not found.
  Future<FoodResolutionResult> resolveByName(
    String name,
    CountryProfile country,
  ) async {
    final resp = await dio.post(
      '$baseUrl/v1/resolve/name',
      data: {'name': name},
      options: Options(headers: {'x-user-country': country.isoCode}),
    );
    return _parseResolveResponse(resp.data as Map<String, dynamic>, country);
  }

  /// Fetch the regional pack manifest from the server (`GET /v1/packs`) — real item counts and
  /// availability, not a static client-side list (Phase 9, `global.p9.incremental_regional_sync`).
  Future<List<RegionalFoodPack>> fetchPackManifest({Map<String, String>? syncedVersions}) async {
    final resp = await dio.get('$baseUrl/v1/packs');
    final packs = (resp.data['data']['packs'] as List).cast<Map<String, dynamic>>();
    return packs
        .map((j) => RegionalFoodPack.fromManifestJson(
              j,
              syncedVersion: syncedVersions?[j['packId'] as String],
            ))
        .toList();
  }

  /// Sync one pack (`GET /v1/packs/:packId/sync`). Pass the pack's current `syncedVersion` (or
  /// omit for a first sync) — an empty `items` list with `upToDate: true` means nothing changed
  /// (or the dataset isn't available server-side); a non-empty list is the full current
  /// snapshot to persist locally (e.g. into Drift), replacing whatever was stored before.
  Future<PackSyncResponse> syncPack(RegionalFoodPack pack) async {
    final resp = await dio.get(
      '$baseUrl/v1/packs/${pack.packId}/sync',
      queryParameters: pack.syncedVersion != null ? {'version': pack.syncedVersion} : null,
    );
    final data = resp.data['data'] as Map<String, dynamic>;
    return PackSyncResponse(
      packId: data['packId'] as String,
      datasetVersion: data['datasetVersion'] as String,
      upToDate: data['upToDate'] as bool,
      items: (data['items'] as List)
          .cast<Map<String, dynamic>>()
          .map((i) => PackSyncItem(
                sourceId: i['sourceId'] as String,
                name: i['name'] as String,
                nutrition: (i['nutrition'] as Map).cast<String, dynamic>(),
              ))
          .toList(),
    );
  }

  FoodResolutionResult _parseResolveResponse(
    Map<String, dynamic> data,
    CountryProfile country,
  ) {
    final resolvedBy = data['resolvedBy'] as String? ?? 'unknown';
    final product = data['product'] as Map<String, dynamic>?;
    if (product == null) {
      return FoodResolutionResult(
        profile: null, country: country.isoCode,
        resolvedBy: FoodDataSource.unknown,
      );
    }
    final source = _mapSource(resolvedBy);
    final profile = FoodProfile(
      id:              product['id'] as String? ?? '',
      name:            product['name'] as String? ?? '',
      source:          source,
      sourceId:        product['sourceId'] as String? ?? '',
      datasetVersion:  product['datasetVersion'] as String? ?? 'live',
      licenseClass:    product['licenseClass'] as String? ?? 'unknown',
      retrievedAt:     DateTime.now(),
      barcode:         product['barcode'] as String?,
      brand:           product['brand'] as String?,
      category:        product['category'] as String?,
      countryOfOrigin: product['countryOfOrigin'] as String?,
      countryCodes:    (product['countryCodes'] as List?)?.cast<String>() ?? [],
      sourceRegion:    product['sourceRegion'] as String?,
      nutrition:       _parseNutrition(product['nutrition'] as Map<String, dynamic>?),
      ingredientsRawText: product['ingredientsRawText'] as String?,
      imageUrl:        product['imageUrl'] as String?,
      resolvedByCountry: country.isoCode,
    );
    return FoodResolutionResult(
      profile: profile, resolvedBy: source, country: country.isoCode,
    );
  }

  FoodNutrition? _parseNutrition(Map<String, dynamic>? n) {
    if (n == null) return null;
    return FoodNutrition(
      energyKcal:    (n['energyKcal'] as num?)?.toDouble(),
      energyKj:      (n['energyKj'] as num?)?.toDouble(),
      proteinG:      (n['proteinG'] as num?)?.toDouble(),
      fatTotalG:     (n['fatTotalG'] as num?)?.toDouble(),
      fatSaturatedG: (n['fatSaturatedG'] as num?)?.toDouble(),
      fatTransG:     (n['fatTransG'] as num?)?.toDouble(),
      carbohydratesG: (n['carbohydratesG'] as num?)?.toDouble(),
      sugarsG:       (n['sugarsG'] as num?)?.toDouble(),
      sodiumMg:      (n['sodiumMg'] as num?)?.toDouble(),
      novaGroup:     n['novaGroup'] as int?,
      confidence:    (n['confidence'] as num?)?.toDouble(),
    );
  }

  FoodDataSource _mapSource(String resolvedBy) => switch (resolvedBy) {
    'cache'          => FoodDataSource.cache,
    'openfoodfacts'  => FoodDataSource.openFoodFacts,
    'ifct_2017'      => FoodDataSource.ifct2017,
    'usda_fdc'       => FoodDataSource.usdaFdc,
    'cofid_2021'     => FoodDataSource.cofid2021,
    'user_submitted' => FoodDataSource.userSubmitted,
    _                => FoodDataSource.unknown,
  };
}

/// Riverpod provider — override with real Dio + baseUrl in app.dart.
final foodIntelligenceServiceProvider = Provider<FoodIntelligenceService>(
  (ref) => throw UnimplementedError('Override foodIntelligenceServiceProvider in app bootstrap'),
);
