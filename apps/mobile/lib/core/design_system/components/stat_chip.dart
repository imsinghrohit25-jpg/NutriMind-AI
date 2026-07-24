import 'package:flutter/material.dart';

import '../tokens.dart';

/// Small glass pill showing one labeled stat (e.g. "340mg sodium", "12 scans today") — the one
/// shared "stat chip" component every screen must reuse instead of hand-rolling its own
/// `Container` + `Row` + `Text` chip (governance rule: no duplicated UI components).
class StatChip extends StatelessWidget {
  const StatChip({
    super.key,
    required this.label,
    this.icon,
    this.color,
    this.value,
  });

  final String label;
  final IconData? icon;
  final Color? color;
  /// Optional numeric/short value shown in a bolder weight before [label] (e.g. "340" + "mg sodium").
  final String? value;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final chipColor = color ?? scheme.primary;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.m, vertical: AppSpacing.s),
      decoration: BoxDecoration(
        color: chipColor.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: chipColor.withValues(alpha: 0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 14, color: chipColor),
            const SizedBox(width: AppSpacing.xs),
          ],
          if (value != null) ...[
            Text(
              value!,
              style: AppType.labelMedium.copyWith(
                color: chipColor,
                fontFeatures: const [FontFeature.tabularFigures()],
              ),
            ),
            const SizedBox(width: AppSpacing.xxs),
          ],
          Text(label, style: AppType.labelSmall.copyWith(color: chipColor)),
        ],
      ),
    );
  }
}
