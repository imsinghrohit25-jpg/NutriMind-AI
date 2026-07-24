import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';

import '../../core/design_system/components/glass_card.dart';
import '../../core/design_system/components/gradient_scaffold.dart';
import '../../core/design_system/components/nutrient_bar.dart';
import '../../core/design_system/components/nutrient_ring.dart';
import '../../core/design_system/haptic_service.dart';
import '../../core/design_system/app_palette.dart';
import '../../core/design_system/tokens.dart';
import '../disease_chips/disease_chips_widget.dart';
import '../safety_badges/safety_badges_widget.dart';
import '../score/score_screen.dart';

// Product detail screen — shows full canonical nutrition and provenance.
// ADR-0007: estimated added sugar is flagged with a disclosure note.
// ODbL: OpenFoodFacts products show inline attribution.
// Disease-aware guidance chips render when the resolve response evaluated the signed-in
// user's stored health conditions against this product (10-condition expansion).
// Premium redesign Phase 3 (ADR-0039): healthScore/safety are the real, wired
// engines/score + engines/allergen output — this screen renders them, never computes them.

// Standard %DV-style reference values (per 100g) — the same convention already used on every
// nutrition facts label worldwide (2000 kcal reference diet), consistent with ADR-0038's
// precedent. Purely a display reference for the animated bars below; never affects the real
// Health Score, which is computed server-side against ICMR-NIN/WHO thresholds.
const _dvEnergyKcal = 2000.0;
const _dvProteinG = 50.0;
const _dvFatTotalG = 78.0;
const _dvFatSaturatedG = 20.0;
const _dvCarbohydratesG = 275.0;
const _dvSugarsG = 50.0;
const _dvFiberG = 28.0;
const _dvSodiumMg = 2300.0;
const _dvCholesterolMg = 300.0;
const _dvCalciumMg = 1300.0;
const _dvIronMg = 18.0;

class ProductScreen extends StatelessWidget {
  const ProductScreen({
    super.key,
    required this.productJson,
    this.diseaseGuidance,
    this.healthScore,
    this.safety,
  });
  final Map<String, dynamic> productJson;
  final List<dynamic>? diseaseGuidance;
  final Map<String, dynamic>? healthScore;
  final Map<String, dynamic>? safety;

  @override
  Widget build(BuildContext context) {
    final name         = productJson['name'] as String? ?? 'Unknown product';
    final brand        = productJson['brand'] as String?;
    final source    = productJson['source'] as String? ?? '';
    final nutrition = productJson['nutrition'] as Map<String, dynamic>?;
    final confidence   = (nutrition?['confidence'] as num?)?.toDouble();

    return GradientScaffold(
      appBar: AppBar(
        title: const Text('Product details'),
        backgroundColor: Colors.transparent,
        actions: [
          if (source == 'openfoodfacts')
            IconButton(
              icon: const Icon(Icons.info_outline),
              tooltip: 'ODbL attribution',
              onPressed: () => _showAttribution(context),
            ),
        ],
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(AppSpacing.xl),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Product header
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(name, style: AppType.headlineLarge),
                  if (brand != null) ...[
                    const SizedBox(height: AppSpacing.xs),
                    Text(brand, style: AppType.bodyMedium.copyWith(color: context.colors.subtle)),
                  ],
                  const SizedBox(height: AppSpacing.m),
                  _SourceChip(source: source),
                  if (confidence != null) ...[
                    const SizedBox(height: AppSpacing.m),
                    _ConfidenceBadge(confidence: confidence),
                  ],
                ],
              ).animate().fadeIn(duration: AppMotion.standard),

            // Allergen Hard Gate — most unmissable position, right below the header, before the
            // user has any reason to scroll away. Untouched detection logic (safety_badges_widget
            // still owns which warnings are dismissible); only the placement/haptic is new here.
            if (safety != null)
              _SafetySection(safety: safety!),

            const SizedBox(height: AppSpacing.xl),

            // Real Health Score hero — the ring's value/color/band all come straight from the
            // engine's own response; tapping it opens the existing full breakdown (ScoreScreen),
            // reused rather than rebuilt.
            if (healthScore != null)
              _HealthScoreHero(healthScore: healthScore!, productName: name)
                  .animate().fadeIn(duration: AppMotion.standard, delay: AppMotion.staggerStep),

            const SizedBox(height: AppSpacing.xl),

            // Disease-aware guidance for the signed-in user's conditions
            if (diseaseGuidance != null && diseaseGuidance!.isNotEmpty) ...[
              DiseaseChipsWidget(diseaseRuleResults: diseaseGuidance!),
              const SizedBox(height: AppSpacing.l),
            ],

            // Nutrition table
            if (nutrition != null) ...[
              const Text('Nutrition per 100g', style: AppType.titleMedium),
              const SizedBox(height: AppSpacing.m),
              GlassCard.static(child: _NutritionBars(nutrition: nutrition)),
            ] else
              const Text('Nutrition data not available.'),

            const SizedBox(height: AppSpacing.xl),

            // Provenance disclosure
            _ProvenanceSection(productJson: productJson),

            // ADR-0007 disclaimer if added sugar is estimated
            if (nutrition?['sugarsAddedEstimated'] == true) ...[
              const SizedBox(height: AppSpacing.l),
              const _EstimationNote(
                text: 'Added sugar: value shown is total sugars as a conservative upper bound (no added-sugar field on this label — ADR-0007).',
              ),
            ],

            // Medical disclaimer (output policy)
            const SizedBox(height: AppSpacing.xl),
            _DisclaimerFooter(),
          ],
        ),
      ),
    ),
    );
  }

  void _showAttribution(BuildContext context) {
    showDialog<void>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Data attribution'),
        content: const Text(
          'Nutrition data sourced from Open Food Facts (openfoodfacts.org). '
          'Licensed under the Open Database License (ODbL 1.0). '
          'This app uses Open Food Facts data, which is made available by Open Food Facts contributors.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Close'),
          ),
        ],
      ),
    );
  }
}

/// One-shot heavy haptic the moment an unsuppressible allergen warning or fail-safe banner is
/// shown — fires once per screen instance (not on every rebuild/scroll), matching the master
/// prompt's "heavy haptic on the Allergen Hard Gate" requirement without touching
/// SafetyBadgesWidget's own dismiss/unsuppressible logic at all.
class _SafetySection extends StatefulWidget {
  const _SafetySection({required this.safety});
  final Map<String, dynamic> safety;

  @override
  State<_SafetySection> createState() => _SafetySectionState();
}

class _SafetySectionState extends State<_SafetySection> {
  @override
  void initState() {
    super.initState();
    final allergenMatches = widget.safety['allergenMatches'] as List<dynamic>? ?? [];
    final hasFailSafe = widget.safety['hasFailSafe'] == true;
    final hasUnsuppressible = allergenMatches
        .whereType<Map<String, dynamic>>()
        .any((m) => m['unsuppressible'] == true);
    if (hasFailSafe || hasUnsuppressible) {
      WidgetsBinding.instance.addPostFrameCallback((_) => HapticService.warning());
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: AppSpacing.l),
      child: SafetyBadgesWidget(
        allergenMatches: widget.safety['allergenMatches'] as List<dynamic>? ?? [],
        childWarnings: widget.safety['childWarnings'] as List<dynamic>? ?? [],
        hasFailSafe: widget.safety['hasFailSafe'] == true,
        failSafeReason: widget.safety['failSafeReason'] as String?,
      ),
    ).animate().shakeX(hz: 4, amount: 3, duration: AppMotion.standard);
  }
}

class _HealthScoreHero extends StatelessWidget {
  const _HealthScoreHero({required this.healthScore, required this.productName});
  final Map<String, dynamic> healthScore;
  final String productName;

  @override
  Widget build(BuildContext context) {
    final score = (healthScore['score'] as num?)?.toDouble() ?? 0;
    final band  = healthScore['band'] as String? ?? 'fair';
    final color = scoreColor(score);

    return GlassCard(
      child: InkWell(
        borderRadius: BorderRadius.circular(20),
        onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(
          builder: (_) => ScoreScreen(scoreJson: healthScore, productName: productName),
        )),
        child: Row(
          children: [
            AnimatedNutrientRing(
              value: score,
              maxValue: 100,
              color: color,
              size: 96,
              strokeWidth: 10,
              label: band.toUpperCase(),
            ),
            const SizedBox(width: AppSpacing.l),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Health Score', style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    'Out of 100 — ICMR-NIN/WHO adapted. Tap for the full breakdown.',
                    style: AppType.bodySmall.copyWith(color: context.colors.subtle),
                  ),
                ],
              ),
            ),
            Icon(Icons.chevron_right, color: context.colors.subtle),
          ],
        ),
      ),
    );
  }
}

class _SourceChip extends StatelessWidget {
  const _SourceChip({required this.source});
  final String source;

  String get _label => switch (source) {
    'openfoodfacts' => 'Open Food Facts',
    'usda_fdc'      => 'USDA FoodData Central',
    'ifct_2017'     => 'IFCT 2017',
    'label_ocr'     => 'Label OCR',
    _               => source,
  };

  Color _color(BuildContext context) => switch (source) {
    'openfoodfacts' => context.colors.info,
    'usda_fdc'      => context.colors.success,
    'ifct_2017'     => context.colors.accent,
    _               => context.colors.subtle,
  };

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.m, vertical: AppSpacing.xs),
      decoration: BoxDecoration(
        color: _color(context).withAlpha(20),
        borderRadius: BorderRadius.circular(AppSpacing.chipRadius),
        border: Border.all(color: _color(context).withAlpha(60)),
      ),
      child: Text(_label, style: AppType.labelSmall.copyWith(color: _color(context))),
    );
  }
}

class _ConfidenceBadge extends StatelessWidget {
  const _ConfidenceBadge({required this.confidence});
  final double confidence;

  @override
  Widget build(BuildContext context) {
    final color = scoreColor(confidence * 100);
    return Row(children: [
      Text(
        'Data quality: ${(confidence * 100).toStringAsFixed(0)}%',
        style: AppType.labelSmall.copyWith(color: color),
      ),
    ]);
  }
}

class _NutritionBars extends StatelessWidget {
  const _NutritionBars({required this.nutrition});
  final Map<String, dynamic> nutrition;

  @override
  Widget build(BuildContext context) {
    final energyKcal = (nutrition['energyKcal'] as num?)?.toDouble();
    final proteinG = (nutrition['proteinG'] as num?)?.toDouble();
    final fatTotalG = (nutrition['fatTotalG'] as num?)?.toDouble();
    final fatSaturatedG = (nutrition['fatSaturatedG'] as num?)?.toDouble();
    final carbohydratesG = (nutrition['carbohydratesG'] as num?)?.toDouble();
    final sugarsG = (nutrition['sugarsG'] as num?)?.toDouble();
    final dietaryFiberG = (nutrition['dietaryFiberG'] as num?)?.toDouble();
    final sodiumMg = (nutrition['sodiumMg'] as num?)?.toDouble();
    final calciumMg = (nutrition['calciumMg'] as num?)?.toDouble();
    final ironMg = (nutrition['ironMg'] as num?)?.toDouble();
    final cholesterolMg = (nutrition['cholesterolMg'] as num?)?.toDouble();

    return Column(children: [
      NutrientBar(
        label: 'Energy', valueText: '${_fmt(energyKcal)} kcal',
        fraction: (energyKcal ?? 0) / _dvEnergyKcal, highlight: true, color: context.colors.primary,
      ),
      NutrientBar(
        label: 'Protein', valueText: '${_fmt(proteinG)} g',
        fraction: (proteinG ?? 0) / _dvProteinG, color: AppColors.scoreGood,
      ),
      NutrientBar(
        label: 'Total Fat', valueText: '${_fmt(fatTotalG)} g',
        fraction: (fatTotalG ?? 0) / _dvFatTotalG, color: context.colors.warning,
      ),
      NutrientBar(
        label: 'Saturated Fat', valueText: '${_fmt(fatSaturatedG)} g', indent: true,
        fraction: (fatSaturatedG ?? 0) / _dvFatSaturatedG, color: AppColors.scorePoor,
      ),
      NutrientBar(
        label: 'Carbohydrates', valueText: '${_fmt(carbohydratesG)} g',
        fraction: (carbohydratesG ?? 0) / _dvCarbohydratesG, color: context.colors.accent,
      ),
      NutrientBar(
        label: 'Total Sugars', valueText: '${_fmt(sugarsG)} g', indent: true,
        fraction: (sugarsG ?? 0) / _dvSugarsG, color: AppColors.scorePoor,
      ),
      if (nutrition['sugarsAddedG'] != null)
        NutrientBar(
          label: 'Added Sugars${nutrition['sugarsAddedEstimated'] == true ? '*' : ''}',
          valueText: '${_fmt((nutrition['sugarsAddedG'] as num?)?.toDouble())} g', indent: true,
          fraction: ((nutrition['sugarsAddedG'] as num?)?.toDouble() ?? 0) / _dvSugarsG,
          color: AppColors.scorePoor,
        ),
      NutrientBar(
        label: 'Dietary Fibre', valueText: '${_fmt(dietaryFiberG)} g',
        fraction: (dietaryFiberG ?? 0) / _dvFiberG, color: AppColors.scoreGood,
      ),
      NutrientBar(
        label: 'Sodium', valueText: '${_fmtInt(sodiumMg)} mg',
        fraction: (sodiumMg ?? 0) / _dvSodiumMg, color: AppColors.scorePoor,
      ),
      if (calciumMg != null)
        NutrientBar(
          label: 'Calcium', valueText: '${_fmtInt(calciumMg)} mg',
          fraction: calciumMg / _dvCalciumMg, color: context.colors.info,
        ),
      if (ironMg != null)
        NutrientBar(
          label: 'Iron', valueText: '${_fmtDec(ironMg)} mg',
          fraction: ironMg / _dvIronMg, color: context.colors.info,
        ),
      if (cholesterolMg != null)
        NutrientBar(
          label: 'Cholesterol', valueText: '${_fmtInt(cholesterolMg)} mg',
          fraction: cholesterolMg / _dvCholesterolMg, color: AppColors.scorePoor,
        ),
    ]);
  }

  String _fmt(double? v) => v != null ? v.toStringAsFixed(1) : '—';
  String _fmtInt(double? v) => v != null ? v.toStringAsFixed(0) : '—';
  String _fmtDec(double? v) => v != null ? v.toStringAsFixed(2) : '—';
}

class _ProvenanceSection extends StatelessWidget {
  const _ProvenanceSection({required this.productJson});
  final Map<String, dynamic> productJson;

  @override
  Widget build(BuildContext context) {
    final datasetVersion = productJson['datasetVersion'] as String?;
    final retrievedAt    = productJson['retrievedAt'] as String?;
    final licenseClass   = productJson['licenseClass'] as String?;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Data provenance', style: AppType.titleSmall),
        const SizedBox(height: AppSpacing.xs),
        if (datasetVersion != null)
          Text('Version: $datasetVersion', style: AppType.bodySmall.copyWith(color: context.colors.subtle)),
        if (retrievedAt != null)
          Text('Retrieved: ${retrievedAt.substring(0, 10)}', style: AppType.bodySmall.copyWith(color: context.colors.subtle)),
        if (licenseClass != null)
          Text('License: $licenseClass', style: AppType.bodySmall.copyWith(color: context.colors.subtle)),
      ],
    );
  }
}

class _EstimationNote extends StatelessWidget {
  const _EstimationNote({required this.text});
  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.m),
      decoration: BoxDecoration(
        color: context.colors.info.withAlpha(10),
        borderRadius: BorderRadius.circular(AppSpacing.chipRadius),
      ),
      child: Text('* $text', style: AppType.bodySmall.copyWith(color: context.colors.info)),
    );
  }
}

class _DisclaimerFooter extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.m),
      decoration: BoxDecoration(
        border: Border.all(color: context.colors.divider),
        borderRadius: BorderRadius.circular(AppSpacing.chipRadius),
      ),
      child: const Text(
        'Nutrition information is for reference only and is not medical advice. '
        'Values are per 100g from third-party databases and may vary by batch or preparation. '
        'Consult a qualified dietitian for personalised guidance.',
        style: AppType.bodySmall,
      ),
    );
  }
}
