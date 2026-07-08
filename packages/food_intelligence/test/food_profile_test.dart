import 'package:flutter_test/flutter_test.dart';
import 'package:nutrimind_food_intelligence/nutrimind_food_intelligence.dart';
import 'package:nutrimind_country_engine/nutrimind_country_engine.dart';

FoodProfile _makeProfile({
  String id = 'test-id',
  String name = 'Test Food',
  FoodDataSource source = FoodDataSource.openFoodFacts,
  List<String> countryCodes = const ['IN'],
  String? sourceRegion = 'IN',
  String resolvedByCountry = 'IN',
}) =>
    FoodProfile(
      id: id, name: name, source: source, sourceId: 'src-001',
      datasetVersion: 'live', licenseClass: 'odbl',
      retrievedAt: DateTime.utc(2026, 1, 1),
      countryCodes: countryCodes, sourceRegion: sourceRegion,
      resolvedByCountry: resolvedByCountry,
    );

void main() {
  group('FoodProfile', () {
    test('JSON round-trip preserves all fields', () {
      final nutrition = FoodNutrition(
        energyKcal: 350.0, proteinG: 12.5, fatTotalG: 8.0,
        carbohydratesG: 55.0, sodiumMg: 320.0, novaGroup: 3,
        confidence: 0.95,
      );
      final original = FoodProfile(
        id: 'abc123', name: 'Dal Makhani', source: FoodDataSource.ifct2017,
        sourceId: 'IFCT-001', datasetVersion: '2017', licenseClass: 'licensed_restricted',
        retrievedAt: DateTime.utc(2026, 6, 1),
        barcode: null, brand: 'Homemade', category: 'Legumes',
        countryOfOrigin: 'IN', countryCodes: ['IN'],
        sourceRegion: 'IN', nutrition: nutrition,
        ingredientsRawText: 'Black lentils, butter, cream',
        imageUrl: null, resolvedByCountry: 'IN',
      );
      final decoded = FoodProfile.fromJson(original.toJson());
      expect(decoded.id,             original.id);
      expect(decoded.name,           original.name);
      expect(decoded.source,         original.source);
      expect(decoded.sourceId,       original.sourceId);
      expect(decoded.countryCodes,   original.countryCodes);
      expect(decoded.sourceRegion,   original.sourceRegion);
      expect(decoded.resolvedByCountry, original.resolvedByCountry);
      expect(decoded.nutrition?.energyKcal, original.nutrition?.energyKcal);
      expect(decoded.nutrition?.novaGroup,  original.nutrition?.novaGroup);
    });

    test('equality by id', () {
      final a = _makeProfile(id: 'same');
      final b = _makeProfile(id: 'same', name: 'Different Name');
      final c = _makeProfile(id: 'other');
      expect(a, equals(b));
      expect(a, isNot(equals(c)));
    });

    test('unknown source deserializes gracefully', () {
      final json = _makeProfile().toJson();
      json['source'] = 'totally_unknown_source';
      final p = FoodProfile.fromJson(json);
      expect(p.source, FoodDataSource.unknown);
    });
  });

  group('FoodNutrition', () {
    test('JSON round-trip', () {
      const n = FoodNutrition(
        energyKcal: 400.0, proteinG: 10.0, fatTotalG: 15.0,
        sodiumMg: 500.0, novaGroup: 4, confidence: 0.8,
      );
      final decoded = FoodNutrition.fromJson(n.toJson());
      expect(decoded.energyKcal, 400.0);
      expect(decoded.novaGroup,  4);
      expect(decoded.confidence, 0.8);
    });

    test('null fields round-trip', () {
      const n = FoodNutrition();
      final decoded = FoodNutrition.fromJson(n.toJson());
      expect(decoded.energyKcal, isNull);
      expect(decoded.novaGroup,  isNull);
    });
  });

  group('FoodDataSource', () {
    test('infoFor returns correct display name for CoFID', () {
      final info = infoFor(FoodDataSource.cofid2021);
      expect(info.displayName, contains('CoFID'));
      expect(info.primaryRegions, contains('GB'));
      expect(info.isActive, isTrue);
    });

    test('infoFor IFCT is active', () {
      final info = infoFor(FoodDataSource.ifct2017);
      expect(info.primaryRegions, contains('IN'));
      expect(info.isActive, isTrue);
    });

    test('infoFor EFSA is inactive (Phase 4)', () {
      expect(infoFor(FoodDataSource.efsa2021).isActive, isFalse);
    });

    test('sourcePriorityFor IN — IFCT first', () {
      final prio = sourcePriorityFor(CountryProfile.india);
      expect(prio.first, FoodDataSource.ifct2017);
    });

    test('sourcePriorityFor GB — CoFID first', () {
      final gb = CountryRegistry.lookup('GB')!;
      final prio = sourcePriorityFor(gb);
      expect(prio.first, FoodDataSource.cofid2021);
    });

    test('sourcePriorityFor US — USDA first', () {
      final us = CountryRegistry.lookup('US')!;
      final prio = sourcePriorityFor(us);
      expect(prio.first, FoodDataSource.usdaFdc);
    });
  });

  group('RegionalFoodPack', () {
    test('kKnownRegionalPacks contains IN, GB, US', () {
      final codes = kKnownRegionalPacks.map((p) => p.countryCode).toList();
      expect(codes, containsAll(['IN', 'GB', 'US']));
    });

    test('CoFID pack has correct dataSourceId', () {
      final cofid = kKnownRegionalPacks.firstWhere((p) => p.countryCode == 'GB');
      expect(cofid.dataSourceId, 'cofid_2021');
      expect(cofid.itemCount, greaterThan(0));
    });

    test('JSON round-trip', () {
      final pack = kKnownRegionalPacks.first;
      final decoded = RegionalFoodPack.fromJson(pack.toJson());
      expect(decoded.packId,    pack.packId);
      expect(decoded.sizeKb,    pack.sizeKb);
      expect(decoded.isDownloaded, false);
    });

    test('copyWith isDownloaded', () {
      final pack  = kKnownRegionalPacks.first;
      final after = pack.copyWith(isDownloaded: true);
      expect(after.isDownloaded, isTrue);
      expect(after.packId, pack.packId);
    });
  });
}
