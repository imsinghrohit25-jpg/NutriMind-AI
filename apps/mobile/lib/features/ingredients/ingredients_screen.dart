import 'package:flutter/material.dart';
import '../../core/design_system/app_palette.dart';
import '../../core/design_system/tokens.dart';

/// Ingredient intelligence screen — shows parsed ingredient list with:
/// - Per-ingredient tokens (name, sub-ingredients, percentage)
/// - Additive INS info from the database (when matched)
/// - NOVA 4 signal badges (red) for ultra-processing additives
/// - Vegetarian/vegan flags where applicable

class IngredientsScreen extends StatelessWidget {
  final List<dynamic> tokens;       // IngredientToken[] from /v1/scans/ocr
  final List<dynamic> additiveInfo; // AdditiveRecord[] from API enrichment

  const IngredientsScreen({
    super.key,
    required this.tokens,
    required this.additiveInfo,
  });

  @override
  Widget build(BuildContext context) {
    final additiveMap = {
      for (final a in additiveInfo)
        if (a is Map<String, dynamic>)
          (a['ins_number'] as String? ?? '').toLowerCase(): a
    };

    return Scaffold(
      appBar: AppBar(title: const Text('Ingredients')),
      body: tokens.isEmpty
          ? const Center(child: Text('No ingredients detected.'))
          : ListView.separated(
              padding: const EdgeInsets.all(AppSpacing.m),
              itemCount: tokens.length,
              separatorBuilder: (_, __) => const Divider(height: 1),
              itemBuilder: (context, i) {
                final token = tokens[i];
                if (token is! Map<String, dynamic>) return const SizedBox.shrink();
                return _IngredientTile(
                  token: token,
                  additive: additiveMap[
                    (token['name'] as String? ?? '').toLowerCase()
                  ],
                );
              },
            ),
    );
  }
}

// ── Per-ingredient tile ─────────────────────────────────────────────────────────

class _IngredientTile extends StatefulWidget {
  final Map<String, dynamic> token;
  final Map<String, dynamic>? additive;

  const _IngredientTile({required this.token, this.additive});

  @override
  State<_IngredientTile> createState() => _IngredientTileState();
}

class _IngredientTileState extends State<_IngredientTile> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final name          = widget.token['name'] as String? ?? '—';
    final pct           = widget.token['percentageRaw'] as String?;
    final subIngredients = (widget.token['subIngredients'] as List<dynamic>?)
        ?.whereType<Map<String, dynamic>>()
        .toList() ?? [];
    final additive = widget.additive;
    final isNova4Signal = additive?['nova_signal'] == true;
    final permitted     = additive?['fssai_permitted'] != false;

    return InkWell(
      onTap: additive != null || subIngredients.isNotEmpty
          ? () => setState(() => _expanded = !_expanded)
          : null,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: AppSpacing.s),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(name, style: AppType.bodyMedium),
                      if (pct != null)
                        Text(pct, style: AppType.bodySmall.copyWith(color: context.colors.subtle)),
                    ],
                  ),
                ),
                if (isNova4Signal)
                  const _Chip(label: 'NOVA 4', color: AppColors.scoreBad),
                if (!permitted)
                  const _Chip(label: 'PROHIBITED', color: AppColors.scoreBad),
                if (additive != null || subIngredients.isNotEmpty)
                  Icon(
                    _expanded ? Icons.keyboard_arrow_up : Icons.keyboard_arrow_down,
                    size: 18,
                    color: context.colors.subtle,
                  ),
              ],
            ),
            if (_expanded) ...[
              if (additive != null) _AdditiveCard(additive: additive),
              if (subIngredients.isNotEmpty) ...[
                const SizedBox(height: AppSpacing.xs),
                Padding(
                  padding: const EdgeInsets.only(left: AppSpacing.m),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Contains:', style: AppType.labelSmall),
                      ...subIngredients.map((sub) => Padding(
                        padding: const EdgeInsets.only(top: 2),
                        child: Text(
                          '• ${sub['name'] as String? ?? '—'}',
                          style: AppType.bodySmall,
                        ),
                      )),
                    ],
                  ),
                ),
              ],
            ],
          ],
        ),
      ),
    );
  }
}

// ── Additive detail card ────────────────────────────────────────────────────────

class _AdditiveCard extends StatelessWidget {
  final Map<String, dynamic> additive;
  const _AdditiveCard({required this.additive});

  @override
  Widget build(BuildContext context) {
    final insNumber  = additive['ins_number'] as String? ?? '';
    final category   = additive['category'] as String? ?? '';
    final safetyNote = additive['safety_note'] as String? ?? '';
    final citation   = additive['citation'] as String? ?? '';
    final permitted  = additive['fssai_permitted'] != false;

    return Container(
      margin: const EdgeInsets.only(top: AppSpacing.s),
      padding: const EdgeInsets.all(AppSpacing.m),
      decoration: BoxDecoration(
        color: context.colors.surface,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: context.colors.divider),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Text(insNumber, style: AppType.labelMedium.copyWith(color: context.colors.primary)),
            const SizedBox(width: AppSpacing.s),
            Text(
              _categoryLabel(category),
              style: AppType.labelSmall.copyWith(color: context.colors.subtle),
            ),
            const Spacer(),
            _Chip(
              label: permitted ? 'FSSAI Permitted' : 'FSSAI Prohibited',
              color: permitted ? AppColors.scoreGood : AppColors.scoreBad,
            ),
          ]),
          const SizedBox(height: AppSpacing.s),
          Text(safetyNote, style: AppType.bodySmall),
          if (citation.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.xs),
            Text(
              citation,
              style: AppType.bodySmall.copyWith(
                color: context.colors.subtle,
                fontStyle: FontStyle.italic,
              ),
            ),
          ],
          const SizedBox(height: AppSpacing.xs),
          Text(
            'This is general information, not medical advice.',
            style: AppType.bodySmall.copyWith(color: context.colors.subtle),
          ),
        ],
      ),
    );
  }

  String _categoryLabel(String category) {
    switch (category) {
      case 'colour':            return 'Colour';
      case 'preservative':      return 'Preservative';
      case 'antioxidant':       return 'Antioxidant';
      case 'thickener':         return 'Thickener / Stabiliser';
      case 'emulsifier':        return 'Emulsifier';
      case 'flavour_enhancer':  return 'Flavour Enhancer';
      case 'sweetener':         return 'Sweetener';
      default:                  return category;
    }
  }
}

// ── Chip badge ──────────────────────────────────────────────────────────────────

class _Chip extends StatelessWidget {
  final String label;
  final Color color;
  const _Chip({required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(left: AppSpacing.xs),
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: color.withAlpha(25),
        borderRadius: BorderRadius.circular(4),
        border: Border.all(color: color.withAlpha(80)),
      ),
      child: Text(
        label,
        style: AppType.labelSmall.copyWith(color: color, fontWeight: FontWeight.w700),
      ),
    );
  }
}
