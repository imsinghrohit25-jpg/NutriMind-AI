import 'package:nutrimind_country_engine/nutrimind_country_engine.dart';

/// All food composition data sources the app knows about.
enum FoodDataSource {
  openFoodFacts,  // world.openfoodfacts.org — global crowdsourced (CC BY-SA)
  usdaFdc,        // fdc.nal.usda.gov — US reference (public domain)
  ifct2017,       // Indian Food Composition Tables 2017 (NIN) — India authoritative
  cofid2021,      // UK Composition of Foods Integrated Dataset — PHE/FSA (OGL v3)
  efsa2021,       // EFSA food composition — EU (licensed)
  ciqual2020,     // CIQUAL — France (Etalab open)
  bls302,         // BLS 3.02 — Germany (MRI, licensed)
  fsanz2019,      // FSANZ — Australia/NZ (CC BY 4.0)
  userSubmitted,  // User curation queue
  cache,          // DB cache hit (backed by one of the above)
  unknown,
}

/// Human-readable source metadata.
class FoodDataSourceInfo {
  const FoodDataSourceInfo({
    required this.source,
    required this.displayName,
    required this.licenseClass,
    required this.primaryRegions,
    required this.isActive,
  });

  final FoodDataSource source;
  final String displayName;
  final String licenseClass;        // 'public_domain' | 'odbl' | 'ogl' | 'licensed_restricted'
  final List<String> primaryRegions; // ISO codes where this source is authoritative
  final bool isActive;
}

const _sourceInfoMap = <FoodDataSource, FoodDataSourceInfo>{
  FoodDataSource.openFoodFacts: FoodDataSourceInfo(
    source: FoodDataSource.openFoodFacts, displayName: 'Open Food Facts',
    licenseClass: 'odbl', primaryRegions: [], isActive: true,
  ),
  FoodDataSource.usdaFdc: FoodDataSourceInfo(
    source: FoodDataSource.usdaFdc, displayName: 'USDA FoodData Central',
    licenseClass: 'public_domain', primaryRegions: ['US', 'CA'], isActive: true,
  ),
  FoodDataSource.ifct2017: FoodDataSourceInfo(
    source: FoodDataSource.ifct2017, displayName: 'IFCT 2017 (NIN India)',
    licenseClass: 'licensed_restricted', primaryRegions: ['IN'], isActive: true,
  ),
  FoodDataSource.cofid2021: FoodDataSourceInfo(
    source: FoodDataSource.cofid2021, displayName: 'CoFID 2021 (UK)',
    licenseClass: 'ogl', primaryRegions: ['GB', 'IE'], isActive: true,
  ),
  FoodDataSource.efsa2021: FoodDataSourceInfo(
    source: FoodDataSource.efsa2021, displayName: 'EFSA 2021 (EU)',
    licenseClass: 'licensed_restricted', primaryRegions: ['DE', 'FR', 'IT', 'ES', 'NL'], isActive: false,
  ),
  FoodDataSource.ciqual2020: FoodDataSourceInfo(
    source: FoodDataSource.ciqual2020, displayName: 'CIQUAL 2020 (France)',
    licenseClass: 'public_domain', primaryRegions: ['FR'], isActive: false,
  ),
  FoodDataSource.bls302: FoodDataSourceInfo(
    source: FoodDataSource.bls302, displayName: 'BLS 3.02 (Germany)',
    licenseClass: 'licensed_restricted', primaryRegions: ['DE'], isActive: false,
  ),
  FoodDataSource.fsanz2019: FoodDataSourceInfo(
    source: FoodDataSource.fsanz2019, displayName: 'FSANZ 2019 (Australia/NZ)',
    licenseClass: 'public_domain', primaryRegions: ['AU', 'NZ'], isActive: false,
  ),
};

FoodDataSourceInfo infoFor(FoodDataSource source) =>
    _sourceInfoMap[source] ?? const FoodDataSourceInfo(
      source: FoodDataSource.unknown, displayName: 'Unknown',
      licenseClass: 'unknown', primaryRegions: [], isActive: false,
    );

/// Returns the preferred source for a given country, in priority order.
List<FoodDataSource> sourcePriorityFor(CountryProfile country) {
  return switch (country.isoCode) {
    'IN'       => [FoodDataSource.ifct2017,   FoodDataSource.openFoodFacts, FoodDataSource.usdaFdc],
    'GB' || 'IE' => [FoodDataSource.cofid2021, FoodDataSource.openFoodFacts, FoodDataSource.usdaFdc],
    'US' || 'CA' => [FoodDataSource.usdaFdc,  FoodDataSource.openFoodFacts],
    'AU' || 'NZ' => [FoodDataSource.openFoodFacts, FoodDataSource.usdaFdc],
    _            => [FoodDataSource.openFoodFacts, FoodDataSource.usdaFdc],
  };
}
