import 'package:flutter/material.dart';

import '../../../core/design_system/tokens.dart';

// Meal photo flow — shows dish identification results with confirmation UI.
// API response is shown with editable portions and disclaimerRequired flag.

class MealPhotoFlowResult extends StatefulWidget {
  const MealPhotoFlowResult({super.key, required this.apiResponse});
  final Map<String, dynamic> apiResponse;

  @override
  State<MealPhotoFlowResult> createState() => _MealPhotoFlowResultState();
}

class _MealPhotoFlowResultState extends State<MealPhotoFlowResult> {
  int _selectedCandidateIndex = 0;

  @override
  Widget build(BuildContext context) {
    final candidates = (widget.apiResponse['candidates'] as List?)?.cast<Map<String, dynamic>>() ?? [];
    final needsConfirmation = widget.apiResponse['needsUserConfirmation'] == true;
    final nutrition = widget.apiResponse['topCandidateNutrition'] as Map<String, dynamic>?;
    final disclaimer = widget.apiResponse['disclaimerRequired'] == true;

    return Scaffold(
      appBar: AppBar(title: const Text('Meal identified')),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.xl),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (needsConfirmation)
                const _ConfirmationBanner(message: 'Please confirm the dish — AI confidence is low'),
              const SizedBox(height: AppSpacing.m),

              // Dish candidates
              if (candidates.isNotEmpty) ...[
                const Text('Identified dishes', style: AppType.titleMedium),
                const SizedBox(height: AppSpacing.m),
                ...candidates.asMap().entries.map((e) => _DishCard(
                  candidate: e.value,
                  selected: e.key == _selectedCandidateIndex,
                  onTap: () => setState(() => _selectedCandidateIndex = e.key),
                )),
              ] else
                const Text('No dishes detected. Please try a clearer photo.'),

              const SizedBox(height: AppSpacing.xl),

              // Nutrition for top candidate
              if (nutrition != null && _selectedCandidateIndex == 0) ...[
                const Text('Nutrition (per 100g)', style: AppType.titleSmall),
                const SizedBox(height: AppSpacing.s),
                _NutritionSummary(nutrition: nutrition),
                const SizedBox(height: AppSpacing.m),
              ],

              if (disclaimer)
                Container(
                  padding: const EdgeInsets.all(AppSpacing.m),
                  decoration: BoxDecoration(
                    color: AppColors.warning.withAlpha(15),
                    borderRadius: BorderRadius.circular(AppSpacing.chipRadius),
                  ),
                  child: const Text(
                    'Nutrition values are estimates based on standard IFCT/USDA data. '
                    'Actual values vary by preparation method and portion.',
                    style: AppType.bodySmall,
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _DishCard extends StatelessWidget {
  const _DishCard({required this.candidate, required this.selected, required this.onTap});
  final Map<String, dynamic> candidate;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final confidence = (candidate['confidence'] as num?)?.toDouble() ?? 0.0;
    final portion = candidate['portionEstimate'] as Map<String, dynamic>?;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: AppSpacing.m),
        padding: const EdgeInsets.all(AppSpacing.l),
        decoration: BoxDecoration(
          color: selected ? AppColors.primary.withAlpha(10) : null,
          border: Border.all(
            color: selected ? AppColors.primary : AppColors.divider,
            width: selected ? 2 : 1,
          ),
          borderRadius: BorderRadius.circular(AppSpacing.chipRadius),
        ),
        child: Row(children: [
          Expanded(child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(candidate['name'] as String? ?? 'Unknown', style: AppType.titleMedium),
              if (candidate['nameLocalised'] != null)
                Text(candidate['nameLocalised'] as String, style: AppType.bodySmall.copyWith(color: AppColors.subtle)),
              if (candidate['cuisine'] != null)
                Text(candidate['cuisine'] as String, style: AppType.bodySmall.copyWith(color: AppColors.subtle)),
              if (portion != null)
                Text(
                  'Estimated: ${portion['portionGrams']} g',
                  style: AppType.bodySmall.copyWith(color: AppColors.primary),
                ),
            ],
          )),
          Column(children: [
            Text(
              '${(confidence * 100).toStringAsFixed(0)}%',
              style: AppType.labelMedium.copyWith(
                color: confidence >= 0.75 ? AppColors.success : AppColors.warning,
              ),
            ),
            Text('confidence', style: AppType.labelSmall.copyWith(color: AppColors.subtle)),
          ]),
        ]),
      ),
    );
  }
}

class _ConfirmationBanner extends StatelessWidget {
  const _ConfirmationBanner({required this.message});
  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.m),
      decoration: BoxDecoration(
        color: AppColors.warning.withAlpha(15),
        borderRadius: BorderRadius.circular(AppSpacing.chipRadius),
        border: Border.all(color: AppColors.warning.withAlpha(60)),
      ),
      child: Row(children: [
        const Icon(Icons.warning_amber_rounded, color: AppColors.warning, size: 20),
        const SizedBox(width: AppSpacing.m),
        Expanded(child: Text(message, style: AppType.bodySmall.copyWith(color: AppColors.warning))),
      ]),
    );
  }
}

class _NutritionSummary extends StatelessWidget {
  const _NutritionSummary({required this.nutrition});
  final Map<String, dynamic> nutrition;

  @override
  Widget build(BuildContext context) {
    return Column(children: [
      _Row('Energy', '${(nutrition['energyKcal'] as num?)?.toStringAsFixed(0) ?? '—'} kcal'),
      _Row('Protein', '${(nutrition['proteinG'] as num?)?.toStringAsFixed(1) ?? '—'} g'),
      _Row('Fat', '${(nutrition['fatTotalG'] as num?)?.toStringAsFixed(1) ?? '—'} g'),
      _Row('Carbs', '${(nutrition['carbohydratesG'] as num?)?.toStringAsFixed(1) ?? '—'} g'),
      _Row('Sodium', '${(nutrition['sodiumMg'] as num?)?.toStringAsFixed(0) ?? '—'} mg'),
    ]);
  }
}

class _Row extends StatelessWidget {
  const _Row(this.label, this.value);
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(children: [
        Expanded(child: Text(label, style: AppType.bodySmall)),
        Text(value, style: AppType.bodySmall.copyWith(fontWeight: FontWeight.w600)),
      ]),
    );
  }
}
