import 'package:flutter/material.dart';

import '../../../core/design_system/app_palette.dart';
import '../../../core/design_system/tokens.dart';
import '../../disease_chips/disease_chips_widget.dart';

// Meal photo flow — multi-dish results from POST /v1/scans/meal.
// Shows every identified dish with its confidence, per-portion nutrition, and (signed-in users
// with stored conditions) disease notes; portion grams are editable and the whole-meal totals
// recompute live from the per-100g panels the API returns per dish.

class MealPhotoFlowResult extends StatefulWidget {
  const MealPhotoFlowResult({super.key, required this.apiResponse});
  final Map<String, dynamic> apiResponse;

  @override
  State<MealPhotoFlowResult> createState() => _MealPhotoFlowResultState();
}

class _MealPhotoFlowResultState extends State<MealPhotoFlowResult> {
  late final List<Map<String, dynamic>> _candidates;
  // Editable grams per dish, seeded from the API's portion estimates. Dishes without resolved
  // nutrition keep a null entry — they're shown but excluded from totals.
  late final List<double?> _grams;

  static const _macroRows = <(String, String, String)>[
    ('energyKcal', 'Energy', 'kcal'),
    ('proteinG', 'Protein', 'g'),
    ('carbohydratesG', 'Carbs', 'g'),
    ('fatTotalG', 'Fat', 'g'),
    ('dietaryFiberG', 'Fiber', 'g'),
    ('sugarsG', 'Sugar', 'g'),
    ('sodiumMg', 'Sodium', 'mg'),
  ];

  static const _microRows = <(String, String, String)>[
    ('fatSaturatedG', 'Saturated fat', 'g'),
    ('cholesterolMg', 'Cholesterol', 'mg'),
    ('calciumMg', 'Calcium', 'mg'),
    ('ironMg', 'Iron', 'mg'),
    ('potassiumMg', 'Potassium', 'mg'),
    ('zincMg', 'Zinc', 'mg'),
    ('vitaminCMg', 'Vitamin C', 'mg'),
    ('vitaminAIu', 'Vitamin A', 'IU'),
    ('vitaminDIu', 'Vitamin D', 'IU'),
    ('vitaminB12Mcg', 'Vitamin B12', 'mcg'),
    ('folateMcg', 'Folate', 'mcg'),
  ];

  @override
  void initState() {
    super.initState();
    _candidates =
        (widget.apiResponse['candidates'] as List?)?.cast<Map<String, dynamic>>() ?? [];
    _grams = _candidates.map((c) {
      if (c['nutritionPer100g'] == null) return null;
      final estimate = c['portionEstimate'] as Map<String, dynamic>?;
      return (estimate?['portionGrams'] as num?)?.toDouble() ?? 150.0;
    }).toList();
  }

  double? _scaled(int dishIndex, String field) {
    final per100g = _candidates[dishIndex]['nutritionPer100g'] as Map<String, dynamic>?;
    final grams = _grams[dishIndex];
    final value = (per100g?[field] as num?)?.toDouble();
    if (value == null || grams == null) return null;
    return value * grams / 100;
  }

  double? _total(String field) {
    double? sum;
    for (var i = 0; i < _candidates.length; i++) {
      final v = _scaled(i, field);
      if (v != null) sum = (sum ?? 0) + v;
    }
    return sum;
  }

  @override
  Widget build(BuildContext context) {
    final needsConfirmation = widget.apiResponse['needsUserConfirmation'] == true;
    final disclaimer = widget.apiResponse['disclaimerRequired'] == true;
    final suitability = widget.apiResponse['mealSuitability'] as Map<String, dynamic>?;
    final resolvedCount = _grams.where((g) => g != null).length;

    return Scaffold(
      appBar: AppBar(title: const Text('Meal identified')),
      body: SafeArea(
        child: _candidates.isEmpty
            ? const Center(
                child: Padding(
                  padding: EdgeInsets.all(AppSpacing.xl),
                  child: Text('No dishes detected. Please try a clearer photo.'),
                ),
              )
            : ListView(
                padding: const EdgeInsets.all(AppSpacing.xl),
                children: [
                  if (needsConfirmation)
                    _Banner(
                      icon: Icons.warning_amber_rounded,
                      color: context.colors.warning,
                      message: 'Please confirm the dishes — AI confidence is low',
                    ),

                  // Whole-meal totals — recompute live as portions are edited.
                  if (resolvedCount > 0) ...[
                    const SizedBox(height: AppSpacing.m),
                    _MealTotalsCard(
                      dishesIncluded: resolvedCount,
                      rows: [
                        for (final (field, label, unit) in _macroRows)
                          if (_total(field) != null) (label, _total(field)!, unit),
                      ],
                    ),
                  ],

                  // Meal-level disease suitability (from the API's totals evaluation)
                  if (suitability != null &&
                      (suitability['notes'] as List?)?.isNotEmpty == true) ...[
                    const SizedBox(height: AppSpacing.l),
                    DiseaseChipsWidget(
                        diseaseRuleResults: suitability['notes'] as List<dynamic>),
                  ],

                  const SizedBox(height: AppSpacing.xl),
                  Text('Identified dishes ($resolvedCount of ${_candidates.length} with nutrition)',
                      style: AppType.titleMedium),
                  const SizedBox(height: AppSpacing.m),

                  for (var i = 0; i < _candidates.length; i++) ...[
                    _DishCard(
                      candidate: _candidates[i],
                      grams: _grams[i],
                      onGramsChanged: (g) => setState(() => _grams[i] = g),
                      macroRows: [
                        for (final (field, label, unit) in _macroRows)
                          if (_scaled(i, field) != null) (label, _scaled(i, field)!, unit),
                      ],
                      microRows: [
                        for (final (field, label, unit) in _microRows)
                          if (_scaled(i, field) != null) (label, _scaled(i, field)!, unit),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.m),
                  ],

                  if (disclaimer)
                    _Banner(
                      icon: Icons.info_outline,
                      color: context.colors.info,
                      message:
                          'Nutrition values are estimates based on standard IFCT/USDA data and '
                          'AI-estimated portions. Actual values vary by preparation and serving size.',
                    ),
                ],
              ),
      ),
    );
  }
}

class _MealTotalsCard extends StatelessWidget {
  const _MealTotalsCard({required this.dishesIncluded, required this.rows});
  final int dishesIncluded;
  final List<(String, double, String)> rows;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.l),
      decoration: BoxDecoration(
        color: context.colors.primary.withAlpha(15),
        borderRadius: BorderRadius.circular(AppSpacing.cardRadius),
        border: Border.all(color: context.colors.primary.withAlpha(60)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Icon(Icons.restaurant, color: context.colors.primary, size: 20),
            const SizedBox(width: AppSpacing.s),
            Text('Meal totals ($dishesIncluded dishes)', style: AppType.titleMedium),
          ]),
          const SizedBox(height: AppSpacing.s),
          for (final (label, value, unit) in rows)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 2),
              child: Row(children: [
                Expanded(child: Text(label, style: AppType.bodyMedium)),
                Text(
                  '${value.toStringAsFixed(unit == 'kcal' || unit == 'mg' ? 0 : 1)} $unit',
                  style: AppType.bodyMedium.copyWith(fontWeight: FontWeight.w700),
                ),
              ]),
            ),
        ],
      ),
    );
  }
}

class _DishCard extends StatefulWidget {
  const _DishCard({
    required this.candidate,
    required this.grams,
    required this.onGramsChanged,
    required this.macroRows,
    required this.microRows,
  });

  final Map<String, dynamic> candidate;
  final double? grams;
  final ValueChanged<double> onGramsChanged;
  final List<(String, double, String)> macroRows;
  final List<(String, double, String)> microRows;

  @override
  State<_DishCard> createState() => _DishCardState();
}

class _DishCardState extends State<_DishCard> {
  bool _showMicros = false;
  late final TextEditingController _gramsCtrl;

  @override
  void initState() {
    super.initState();
    _gramsCtrl = TextEditingController(
      text: widget.grams != null ? widget.grams!.round().toString() : '',
    );
  }

  @override
  void dispose() {
    _gramsCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = widget.candidate;
    final confidence = (c['confidence'] as num?)?.toDouble() ?? 0.0;
    final resolved = c['nutritionPer100g'] != null;
    final diseaseNotes = c['diseaseNotes'] as List<dynamic>?;
    final portionMethod =
        (c['portionEstimate'] as Map<String, dynamic>?)?['method'] as String?;

    return Container(
      padding: const EdgeInsets.all(AppSpacing.l),
      decoration: BoxDecoration(
        border: Border.all(color: context.colors.divider),
        borderRadius: BorderRadius.circular(AppSpacing.cardRadius),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(c['name'] as String? ?? 'Unknown', style: AppType.titleMedium),
                  if (c['nameLocalised'] != null)
                    Text(c['nameLocalised'] as String,
                        style: AppType.bodySmall.copyWith(color: context.colors.subtle)),
                  if (c['cuisine'] != null)
                    Text(c['cuisine'] as String,
                        style: AppType.bodySmall.copyWith(color: context.colors.subtle)),
                ],
              ),
            ),
            Column(children: [
              Text(
                '${(confidence * 100).toStringAsFixed(0)}%',
                style: AppType.labelMedium.copyWith(
                  color: confidence >= 0.75 ? context.colors.success : context.colors.warning,
                ),
              ),
              Text('confidence', style: AppType.labelSmall.copyWith(color: context.colors.subtle)),
            ]),
          ]),

          if (resolved) ...[
            const SizedBox(height: AppSpacing.m),
            // Editable portion
            Row(children: [
              const Text('Portion:', style: AppType.bodyMedium),
              const SizedBox(width: AppSpacing.m),
              SizedBox(
                width: 72,
                child: TextField(
                  controller: _gramsCtrl,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(
                    isDense: true,
                    suffixText: 'g',
                    border: OutlineInputBorder(),
                    contentPadding:
                        EdgeInsets.symmetric(horizontal: AppSpacing.s, vertical: AppSpacing.s),
                  ),
                  onChanged: (text) {
                    final g = double.tryParse(text);
                    if (g != null && g > 0 && g <= 5000) widget.onGramsChanged(g);
                  },
                ),
              ),
              if (portionMethod == 'default_guess') ...[
                const SizedBox(width: AppSpacing.s),
                Expanded(
                  child: Text('estimated — please confirm',
                      style: AppType.labelSmall.copyWith(color: context.colors.warning)),
                ),
              ],
            ]),

            const SizedBox(height: AppSpacing.m),
            for (final (label, value, unit) in widget.macroRows)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 1),
                child: Row(children: [
                  Expanded(child: Text(label, style: AppType.bodySmall)),
                  Text(
                    '${value.toStringAsFixed(unit == 'kcal' || unit == 'mg' ? 0 : 1)} $unit',
                    style: AppType.bodySmall.copyWith(fontWeight: FontWeight.w600),
                  ),
                ]),
              ),

            if (widget.microRows.isNotEmpty) ...[
              const SizedBox(height: AppSpacing.s),
              InkWell(
                onTap: () => setState(() => _showMicros = !_showMicros),
                child: Row(children: [
                  Text(
                    _showMicros ? 'Hide vitamins & minerals' : 'Show vitamins & minerals',
                    style: AppType.labelMedium.copyWith(color: context.colors.primary),
                  ),
                  Icon(_showMicros ? Icons.keyboard_arrow_up : Icons.keyboard_arrow_down,
                      size: 16, color: context.colors.primary),
                ]),
              ),
              if (_showMicros)
                for (final (label, value, unit) in widget.microRows)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 1),
                    child: Row(children: [
                      Expanded(child: Text(label, style: AppType.bodySmall)),
                      Text('${value.toStringAsFixed(1)} $unit',
                          style: AppType.bodySmall.copyWith(fontWeight: FontWeight.w600)),
                    ]),
                  ),
            ],

            if (diseaseNotes != null && diseaseNotes.isNotEmpty) ...[
              const SizedBox(height: AppSpacing.m),
              DiseaseChipsWidget(diseaseRuleResults: diseaseNotes),
            ],
          ] else ...[
            const SizedBox(height: AppSpacing.s),
            Text('Nutrition not found for this dish',
                style: AppType.bodySmall.copyWith(color: context.colors.subtle)),
          ],
        ],
      ),
    );
  }
}

class _Banner extends StatelessWidget {
  const _Banner({required this.icon, required this.color, required this.message});
  final IconData icon;
  final Color color;
  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.m),
      decoration: BoxDecoration(
        color: color.withAlpha(15),
        borderRadius: BorderRadius.circular(AppSpacing.chipRadius),
        border: Border.all(color: color.withAlpha(60)),
      ),
      child: Row(children: [
        Icon(icon, color: color, size: 20),
        const SizedBox(width: AppSpacing.m),
        Expanded(child: Text(message, style: AppType.bodySmall)),
      ]),
    );
  }
}
