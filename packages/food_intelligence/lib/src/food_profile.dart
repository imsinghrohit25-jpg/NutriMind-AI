import 'package:nutrimind_country_engine/nutrimind_country_engine.dart';
import 'food_data_source.dart';

/// Unified food profile — Dart-side representation of a food item resolved
/// through the country-aware waterfall. Mirrors CanonicalProduct (API) with
/// country context added.
class FoodProfile {
  const FoodProfile({
    required this.id,
    required this.name,
    required this.source,
    required this.sourceId,
    required this.datasetVersion,
    required this.licenseClass,
    required this.retrievedAt,
    this.barcode,
    this.brand,
    this.category,
    this.countryOfOrigin,
    this.countryCodes = const [],
    this.sourceRegion,
    this.nutrition,
    this.ingredientsRawText,
    this.imageUrl,
    required this.resolvedByCountry,
  });

  final String id;
  final String name;
  final FoodDataSource source;
  final String sourceId;
  final String datasetVersion;
  final String licenseClass;
  final DateTime retrievedAt;
  final String? barcode;
  final String? brand;
  final String? category;
  final String? countryOfOrigin;
  final List<String> countryCodes;
  final String? sourceRegion;
  final FoodNutrition? nutrition;
  final String? ingredientsRawText;
  final String? imageUrl;

  /// ISO code of the CountryProfile that resolved this product.
  final String resolvedByCountry;

  Map<String, dynamic> toJson() => {
    'id': id, 'name': name,
    'source': source.name, 'sourceId': sourceId,
    'datasetVersion': datasetVersion, 'licenseClass': licenseClass,
    'retrievedAt': retrievedAt.toIso8601String(),
    'barcode': barcode, 'brand': brand, 'category': category,
    'countryOfOrigin': countryOfOrigin, 'countryCodes': countryCodes,
    'sourceRegion': sourceRegion,
    'nutrition': nutrition?.toJson(),
    'ingredientsRawText': ingredientsRawText, 'imageUrl': imageUrl,
    'resolvedByCountry': resolvedByCountry,
  };

  factory FoodProfile.fromJson(Map<String, dynamic> j) => FoodProfile(
    id:                j['id'] as String,
    name:              j['name'] as String,
    source:            FoodDataSource.values.firstWhere(
                         (e) => e.name == j['source'],
                         orElse: () => FoodDataSource.unknown),
    sourceId:          j['sourceId'] as String,
    datasetVersion:    j['datasetVersion'] as String,
    licenseClass:      j['licenseClass'] as String,
    retrievedAt:       DateTime.parse(j['retrievedAt'] as String),
    barcode:           j['barcode'] as String?,
    brand:             j['brand'] as String?,
    category:          j['category'] as String?,
    countryOfOrigin:   j['countryOfOrigin'] as String?,
    countryCodes:      (j['countryCodes'] as List?)?.cast<String>() ?? [],
    sourceRegion:      j['sourceRegion'] as String?,
    nutrition:         j['nutrition'] == null ? null : FoodNutrition.fromJson(j['nutrition'] as Map<String, dynamic>),
    ingredientsRawText: j['ingredientsRawText'] as String?,
    imageUrl:          j['imageUrl'] as String?,
    resolvedByCountry: j['resolvedByCountry'] as String? ?? 'IN',
  );

  @override
  bool operator ==(Object other) => other is FoodProfile && other.id == id;
  @override
  int get hashCode => id.hashCode;
}

/// Nutrition values per 100g (or 100ml for liquids).
class FoodNutrition {
  const FoodNutrition({
    this.energyKcal,
    this.energyKj,
    this.proteinG,
    this.fatTotalG,
    this.fatSaturatedG,
    this.fatTransG,
    this.carbohydratesG,
    this.sugarsG,
    this.sugarsAddedG,
    this.dietaryFiberG,
    this.sodiumMg,
    this.calciumMg,
    this.ironMg,
    this.potassiumMg,
    this.zincMg,
    this.vitaminCMg,
    this.novaGroup,
    this.confidence,
  });

  final double? energyKcal;
  final double? energyKj;
  final double? proteinG;
  final double? fatTotalG;
  final double? fatSaturatedG;
  final double? fatTransG;
  final double? carbohydratesG;
  final double? sugarsG;
  final double? sugarsAddedG;
  final double? dietaryFiberG;
  final double? sodiumMg;
  final double? calciumMg;
  final double? ironMg;
  final double? potassiumMg;
  final double? zincMg;
  final double? vitaminCMg;
  final int? novaGroup;   // 1–4
  final double? confidence; // 0.0–1.0

  Map<String, dynamic> toJson() => {
    'energyKcal': energyKcal, 'energyKj': energyKj,
    'proteinG': proteinG, 'fatTotalG': fatTotalG,
    'fatSaturatedG': fatSaturatedG, 'fatTransG': fatTransG,
    'carbohydratesG': carbohydratesG, 'sugarsG': sugarsG,
    'sugarsAddedG': sugarsAddedG, 'dietaryFiberG': dietaryFiberG,
    'sodiumMg': sodiumMg, 'calciumMg': calciumMg,
    'ironMg': ironMg, 'potassiumMg': potassiumMg,
    'zincMg': zincMg, 'vitaminCMg': vitaminCMg,
    'novaGroup': novaGroup, 'confidence': confidence,
  };

  factory FoodNutrition.fromJson(Map<String, dynamic> j) => FoodNutrition(
    energyKcal:   (j['energyKcal'] as num?)?.toDouble(),
    energyKj:     (j['energyKj'] as num?)?.toDouble(),
    proteinG:     (j['proteinG'] as num?)?.toDouble(),
    fatTotalG:    (j['fatTotalG'] as num?)?.toDouble(),
    fatSaturatedG: (j['fatSaturatedG'] as num?)?.toDouble(),
    fatTransG:    (j['fatTransG'] as num?)?.toDouble(),
    carbohydratesG: (j['carbohydratesG'] as num?)?.toDouble(),
    sugarsG:      (j['sugarsG'] as num?)?.toDouble(),
    sugarsAddedG: (j['sugarsAddedG'] as num?)?.toDouble(),
    dietaryFiberG: (j['dietaryFiberG'] as num?)?.toDouble(),
    sodiumMg:     (j['sodiumMg'] as num?)?.toDouble(),
    calciumMg:    (j['calciumMg'] as num?)?.toDouble(),
    ironMg:       (j['ironMg'] as num?)?.toDouble(),
    potassiumMg:  (j['potassiumMg'] as num?)?.toDouble(),
    zincMg:       (j['zincMg'] as num?)?.toDouble(),
    vitaminCMg:   (j['vitaminCMg'] as num?)?.toDouble(),
    novaGroup:    (j['novaGroup'] as int?),
    confidence:   (j['confidence'] as num?)?.toDouble(),
  );
}
