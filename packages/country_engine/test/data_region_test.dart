import 'package:flutter_test/flutter_test.dart';
import 'package:nutrimind_country_engine/nutrimind_country_engine.dart';

void main() {
  group('targetRegionFor', () {
    test('targets euWest1 for EU/UK GDPR countries', () {
      for (final iso in ['GB', 'DE', 'FR', 'IT', 'ES', 'NL']) {
        expect(targetRegionFor(iso), DataRegion.euWest1);
        expect(residencyRequiredFor(iso), true);
      }
    });

    test('is case-insensitive', () {
      expect(targetRegionFor('de'), DataRegion.euWest1);
    });

    test('targets usEast1 for North America', () {
      for (final iso in ['US', 'CA', 'MX']) {
        expect(targetRegionFor(iso), DataRegion.usEast1);
        expect(residencyRequiredFor(iso), false);
      }
    });

    test('defaults to apSouth1 for every other country', () {
      for (final iso in ['IN', 'AE', 'SG', 'AU', 'JP', 'GLOBAL']) {
        expect(targetRegionFor(iso), DataRegion.apSouth1);
      }
    });
  });

  group('resolveDataRegion', () {
    test('active region is always apSouth1 today — the sole live deployment', () {
      expect(resolveDataRegion('DE').active, DataRegion.apSouth1);
      expect(resolveDataRegion('IN').active, DataRegion.apSouth1);
    });

    test('residencySatisfied is true only when target matches the active region', () {
      expect(resolveDataRegion('IN').residencySatisfied, true);
      expect(resolveDataRegion('DE').residencySatisfied, false);
    });

    test('never fabricates residency compliance for a residency-required country', () {
      final r = resolveDataRegion('DE');
      expect(r.residencyRequired, true);
      expect(r.residencySatisfied, false);
    });
  });

  group('resolveDataRegionForProfile', () {
    test('resolves from the India CountryProfile', () {
      final india = CountryRegistry.lookupOrGlobal('IN');
      final r = resolveDataRegionForProfile(india);
      expect(r.target, DataRegion.apSouth1);
      expect(r.residencyRequired, false);
    });

    test('resolves eu-west-1 target for the Germany CountryProfile', () {
      final germany = CountryRegistry.lookupOrGlobal('DE');
      final r = resolveDataRegionForProfile(germany);
      expect(r.target, DataRegion.euWest1);
      expect(r.residencyRequired, true);
    });
  });

  test('dataRegionInfo returns display metadata matching server REGION_REGISTRY', () {
    expect(dataRegionInfo(DataRegion.apSouth1).live, true);
    expect(dataRegionInfo(DataRegion.euWest1).live, false);
    expect(dataRegionInfo(DataRegion.usEast1).live, false);
  });
}
