import 'package:flutter/material.dart';

import '../../core/design_system/tokens.dart';

// Product detail screen — shows full canonical nutrition and provenance.
// ADR-0007: estimated added sugar is flagged with a disclosure note.
// ODbL: OpenFoodFacts products show inline attribution.

class ProductScreen extends StatelessWidget {
  const ProductScreen({super.key, required this.productJson});
  final Map<String, dynamic> productJson;

  @override
  Widget build(BuildContext context) {
    final name         = productJson['name'] as String? ?? 'Unknown product';
    final brand        = productJson['brand'] as String?;
    final source    = productJson['source'] as String? ?? '';
    final nutrition = productJson['nutrition'] as Map<String, dynamic>?;
    final confidence   = (nutrition?['confidence'] as num?)?.toDouble();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Product details'),
        actions: [
          if (source == 'openfoodfacts')
            IconButton(
              icon: const Icon(Icons.info_outline),
              tooltip: 'ODbL attribution',
              onPressed: () => _showAttribution(context),
            ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Product header
            Text(name, style: AppType.headlineLarge),
            if (brand != null) ...[
              const SizedBox(height: AppSpacing.xs),
              Text(brand, style: AppType.bodyMedium.copyWith(color: AppColors.subtle)),
            ],
            const SizedBox(height: AppSpacing.m),
            _SourceChip(source: source),

            // Confidence badge
            if (confidence != null) ...[
              const SizedBox(height: AppSpacing.m),
              _ConfidenceBadge(confidence: confidence),
            ],

            const SizedBox(height: AppSpacing.xl),

            // Nutrition table
            if (nutrition != null) ...[
              const Text('Nutrition per 100g', style: AppType.titleMedium),
              const SizedBox(height: AppSpacing.m),
              _NutritionTable(nutrition: nutrition),
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

  Color get _color => switch (source) {
    'openfoodfacts' => AppColors.info,
    'usda_fdc'      => AppColors.success,
    'ifct_2017'     => AppColors.accent,
    _               => AppColors.subtle,
  };

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.m, vertical: AppSpacing.xs),
      decoration: BoxDecoration(
        color: _color.withAlpha(20),
        borderRadius: BorderRadius.circular(AppSpacing.chipRadius),
        border: Border.all(color: _color.withAlpha(60)),
      ),
      child: Text(_label, style: AppType.labelSmall.copyWith(color: _color)),
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

class _NutritionTable extends StatelessWidget {
  const _NutritionTable({required this.nutrition});
  final Map<String, dynamic> nutrition;

  @override
  Widget build(BuildContext context) {
    return Column(children: [
      _NutrientRow('Energy',          '${_fmt(nutrition['energyKcal'])} kcal', highlight: true),
      _NutrientRow('Protein',         '${_fmt(nutrition['proteinG'])} g'),
      _NutrientRow('Total Fat',       '${_fmt(nutrition['fatTotalG'])} g'),
      _NutrientRow('  Saturated Fat', '${_fmt(nutrition['fatSaturatedG'])} g', indent: true),
      _NutrientRow('  Trans Fat',     '${_fmt(nutrition['fatTransG'])} g', indent: true),
      _NutrientRow('Carbohydrates',   '${_fmt(nutrition['carbohydratesG'])} g'),
      _NutrientRow('  Total Sugars',  '${_fmt(nutrition['sugarsG'])} g', indent: true),
      if (nutrition['sugarsAddedG'] != null)
        _NutrientRow(
          '  Added Sugars${nutrition['sugarsAddedEstimated'] == true ? '*' : ''}',
          '${_fmt(nutrition['sugarsAddedG'])} g',
          indent: true,
        ),
      _NutrientRow('Dietary Fibre',   '${_fmt(nutrition['dietaryFiberG'])} g'),
      _NutrientRow('Sodium',          '${_fmtInt(nutrition['sodiumMg'])} mg'),
      if (nutrition['calciumMg'] != null)
        _NutrientRow('Calcium',       '${_fmtInt(nutrition['calciumMg'])} mg'),
      if (nutrition['ironMg'] != null)
        _NutrientRow('Iron',          '${_fmtDec(nutrition['ironMg'])} mg'),
      if (nutrition['cholesterolMg'] != null)
        _NutrientRow('Cholesterol',   '${_fmtInt(nutrition['cholesterolMg'])} mg'),
    ]);
  }

  String _fmt(dynamic v) => v != null ? (v as num).toStringAsFixed(1) : '—';
  String _fmtInt(dynamic v) => v != null ? (v as num).toStringAsFixed(0) : '—';
  String _fmtDec(dynamic v) => v != null ? (v as num).toStringAsFixed(2) : '—';
}

class _NutrientRow extends StatelessWidget {
  const _NutrientRow(this.label, this.value, {this.highlight = false, this.indent = false});
  final String label;
  final String value;
  final bool highlight;
  final bool indent;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs, horizontal: AppSpacing.m),
      decoration: BoxDecoration(
        color: highlight ? AppColors.primary.withAlpha(8) : null,
        border: const Border(bottom: BorderSide(color: AppColors.divider, width: 0.5)),
      ),
      child: Row(children: [
        if (indent) const SizedBox(width: AppSpacing.l),
        Expanded(child: Text(label, style: highlight ? AppType.titleSmall : AppType.bodySmall)),
        Text(value, style: (highlight ? AppType.titleSmall : AppType.bodySmall)
            .copyWith(fontWeight: FontWeight.w600)),
      ]),
    );
  }
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
          Text('Version: $datasetVersion', style: AppType.bodySmall.copyWith(color: AppColors.subtle)),
        if (retrievedAt != null)
          Text('Retrieved: ${retrievedAt.substring(0, 10)}', style: AppType.bodySmall.copyWith(color: AppColors.subtle)),
        if (licenseClass != null)
          Text('License: $licenseClass', style: AppType.bodySmall.copyWith(color: AppColors.subtle)),
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
        color: AppColors.info.withAlpha(10),
        borderRadius: BorderRadius.circular(AppSpacing.chipRadius),
      ),
      child: Text('* $text', style: AppType.bodySmall.copyWith(color: AppColors.info)),
    );
  }
}

class _DisclaimerFooter extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.m),
      decoration: BoxDecoration(
        border: Border.all(color: AppColors.divider),
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
