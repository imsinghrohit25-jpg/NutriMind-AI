// Tests for FoodIntelligenceService's Phase 9 pack-sync methods, against a fake HttpClientAdapter
// (no real network — validates URL construction, query params, and JSON parsing against the
// real server response shape from apps/api/src/packs/{types,sync-service}.ts). This is also the
// first test coverage for this service's HTTP-calling methods at all — resolveBarcode/
// resolveByName previously had none, which is how the '/api/v1' vs '/v1' path bug (fixed this
// phase) went undetected.

import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nutrimind_country_engine/nutrimind_country_engine.dart';
import 'package:nutrimind_food_intelligence/nutrimind_food_intelligence.dart';

class _FakeAdapter implements HttpClientAdapter {
  _FakeAdapter(this.handler);

  final ResponseBody Function(RequestOptions options) handler;
  final List<RequestOptions> requests = [];

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    requests.add(options);
    return handler(options);
  }

  @override
  void close({bool force = false}) {}
}

ResponseBody _jsonResponse(Map<String, dynamic> body) {
  final bytes = utf8.encode(jsonEncode(body));
  return ResponseBody.fromBytes(bytes, 200, headers: {
    Headers.contentTypeHeader: [Headers.jsonContentType],
  });
}

void main() {
  group('fetchPackManifest', () {
    test('calls GET /v1/packs (not /api/v1/packs) and parses the manifest', () async {
      final adapter = _FakeAdapter((options) => _jsonResponse({
            'ok': true,
            'data': {
              'packs': [
                {
                  'packId': 'ifct_in_2017', 'countryCode': 'IN', 'dataSourceId': 'ifct_2017',
                  'displayName': 'India food pack (IFCT 2017)', 'itemCount': 528,
                  'datasetVersion': '2017', 'available': true,
                },
              ],
            },
          }));
      final dio = Dio(BaseOptions())..httpClientAdapter = adapter;
      final service = FoodIntelligenceService(dio: dio, baseUrl: 'https://api.example.com');

      final packs = await service.fetchPackManifest();

      expect(adapter.requests.single.path, 'https://api.example.com/v1/packs');
      expect(packs, hasLength(1));
      expect(packs.first.packId, 'ifct_in_2017');
      expect(packs.first.available, isTrue);
    });

    test('carries syncedVersions through to the parsed packs', () async {
      final adapter = _FakeAdapter((options) => _jsonResponse({
            'ok': true,
            'data': {
              'packs': [
                {
                  'packId': 'ifct_in_2017', 'countryCode': 'IN', 'dataSourceId': 'ifct_2017',
                  'displayName': 'India food pack', 'itemCount': 528,
                  'datasetVersion': '2017', 'available': true,
                },
              ],
            },
          }));
      final dio = Dio(BaseOptions())..httpClientAdapter = adapter;
      final service = FoodIntelligenceService(dio: dio, baseUrl: 'https://api.example.com');

      final packs = await service.fetchPackManifest(syncedVersions: {'ifct_in_2017': '2016'});

      expect(packs.first.syncedVersion, '2016');
      expect(packs.first.needsSync, isTrue); // 2016 cached, server has 2017
    });
  });

  group('syncPack', () {
    test('calls GET /v1/packs/:packId/sync with the version query param and parses items', () async {
      final adapter = _FakeAdapter((options) => _jsonResponse({
            'ok': true,
            'data': {
              'packId': 'ifct_in_2017',
              'datasetVersion': '2017',
              'upToDate': false,
              'items': [
                {'sourceId': 'A001', 'name': 'Masoor Dal', 'nutrition': {'energyKcal': 343}},
              ],
            },
          }));
      final dio = Dio(BaseOptions())..httpClientAdapter = adapter;
      final service = FoodIntelligenceService(dio: dio, baseUrl: 'https://api.example.com');
      final pack = RegionalFoodPack.fromManifestJson({
        'packId': 'ifct_in_2017', 'countryCode': 'IN', 'dataSourceId': 'ifct_2017',
        'displayName': 'India food pack', 'itemCount': 528,
        'datasetVersion': '2017', 'available': true,
      }, syncedVersion: '2016');

      final result = await service.syncPack(pack);

      final req = adapter.requests.single;
      expect(req.path, 'https://api.example.com/v1/packs/ifct_in_2017/sync');
      expect(req.queryParameters['version'], '2016');
      expect(result.upToDate, isFalse);
      expect(result.items.single.sourceId, 'A001');
      expect(result.items.single.nutrition['energyKcal'], 343);
    });

    test('omits the version query param on a first sync', () async {
      final adapter = _FakeAdapter((options) => _jsonResponse({
            'ok': true,
            'data': {'packId': 'ifct_in_2017', 'datasetVersion': '2017', 'upToDate': false, 'items': <dynamic>[]},
          }));
      final dio = Dio(BaseOptions())..httpClientAdapter = adapter;
      final service = FoodIntelligenceService(dio: dio, baseUrl: 'https://api.example.com');
      final pack = RegionalFoodPack.fromManifestJson({
        'packId': 'ifct_in_2017', 'countryCode': 'IN', 'dataSourceId': 'ifct_2017',
        'displayName': 'India food pack', 'itemCount': 528,
        'datasetVersion': '2017', 'available': true,
      });

      await service.syncPack(pack);

      expect(adapter.requests.single.queryParameters.containsKey('version'), isFalse);
    });
  });

  group('resolveBarcode / resolveByName path fix', () {
    test('resolveBarcode calls /v1/resolve/barcode, not /api/v1/resolve/barcode', () async {
      final adapter = _FakeAdapter((options) => _jsonResponse({'resolvedBy': 'not_found', 'product': null}));
      final dio = Dio(BaseOptions())..httpClientAdapter = adapter;
      final service = FoodIntelligenceService(dio: dio, baseUrl: 'https://api.example.com');

      await service.resolveBarcode('8901234567890', CountryRegistry.lookupOrGlobal('IN'));

      expect(adapter.requests.single.path, 'https://api.example.com/v1/resolve/barcode');
    });

    test('resolveByName calls /v1/resolve/name, not /api/v1/resolve/name', () async {
      final adapter = _FakeAdapter((options) => _jsonResponse({'resolvedBy': 'not_found', 'product': null}));
      final dio = Dio(BaseOptions())..httpClientAdapter = adapter;
      final service = FoodIntelligenceService(dio: dio, baseUrl: 'https://api.example.com');

      await service.resolveByName('dal', CountryRegistry.lookupOrGlobal('IN'));

      expect(adapter.requests.single.path, 'https://api.example.com/v1/resolve/name');
    });
  });
}
