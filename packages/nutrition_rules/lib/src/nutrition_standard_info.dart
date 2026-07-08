import 'package:nutrimind_country_engine/nutrimind_country_engine.dart';

/// Display metadata for a country nutrition standard — mirrors the `displayName`,
/// `authority`, and `version` fields of the TypeScript `CountryNutritionStandard`
/// packs in `apps/api/src/engines/score/standards/*.ts`. This is metadata only:
/// the actual score computation stays server-side (single source of truth — see
/// ADR-0017 §5). This package exists so the UI can show "scored against <authority>"
/// context without duplicating the scoring math on the client.
class NutritionStandardInfo {
  const NutritionStandardInfo({
    required this.standard,
    required this.displayName,
    required this.authority,
    required this.version,
  });

  final NutritionStandard standard;
  final String displayName;
  final String authority;
  final String version;
}

const _standardInfoMap = <NutritionStandard, NutritionStandardInfo>{
  NutritionStandard.icmrNin: NutritionStandardInfo(
    standard: NutritionStandard.icmrNin,
    displayName: 'India — ICMR-NIN 2020 + FSSAI 2022',
    authority: 'ICMR-NIN / FSSAI',
    version: '2020',
  ),
  NutritionStandard.usDri: NutritionStandardInfo(
    standard: NutritionStandard.usDri,
    displayName: 'United States / Canada — FDA Daily Values 2020',
    authority: 'FDA / USDA',
    version: '2020',
  ),
  NutritionStandard.ukSacn: NutritionStandardInfo(
    standard: NutritionStandard.ukSacn,
    displayName: 'United Kingdom — FSA Traffic Light + SACN',
    authority: 'FSA / DHSC / SACN',
    version: '2020',
  ),
  NutritionStandard.efsa: NutritionStandardInfo(
    standard: NutritionStandard.efsa,
    displayName: 'European Union — Nutri-Score 2023 + EFSA DRVs',
    authority: 'EFSA / European Nutri-Score Coordination Committee',
    version: '2023',
  ),
  NutritionStandard.nhmrc: NutritionStandardInfo(
    standard: NutritionStandard.nhmrc,
    displayName: 'Australia / New Zealand — NHMRC + Health Star Rating',
    authority: 'NHMRC / FSANZ',
    version: '2024',
  ),
  NutritionStandard.jpDri: NutritionStandardInfo(
    standard: NutritionStandard.jpDri,
    displayName: 'Japan — CAA Food Labeling Standards + MHLW DRI 2025',
    authority: 'Consumer Affairs Agency / MHLW',
    version: '2025',
  ),
  NutritionStandard.hpbSg: NutritionStandardInfo(
    standard: NutritionStandard.hpbSg,
    displayName: 'Singapore — HPB Nutri-Grade + Healthier Choice Symbol',
    authority: 'Health Promotion Board',
    version: '2025',
  ),
  NutritionStandard.who: NutritionStandardInfo(
    standard: NutritionStandard.who,
    displayName: 'Global — WHO Population Nutrient Intake Goals',
    authority: 'World Health Organization',
    version: '2023',
  ),
};

/// Look up display metadata for a nutrition standard. Every enum value is
/// registered (validated by `nutrition_standard_info_test.dart`), so this never
/// falls back silently — a missing entry is a build-time test failure, not a
/// runtime surprise.
NutritionStandardInfo infoFor(NutritionStandard standard) => _standardInfoMap[standard]!;

/// Convenience accessor — the nutrition standard metadata for a resolved country.
NutritionStandardInfo standardInfoFor(CountryProfile country) =>
    infoFor(country.nutritionStandard);
