import 'package:flutter/material.dart';
import '../../core/design_system/app_palette.dart';
import '../../core/design_system/tokens.dart';

/// Child mode banner — shown at the top of product screen when the active
/// household member is aged ≤ 12. Indicates stricter safety thresholds apply.
/// The banner is informational only and cannot be dismissed while child profile is active.

class ChildModeBanner extends StatelessWidget {
  final String memberName;
  final int ageYears;

  const ChildModeBanner({
    super.key,
    required this.memberName,
    required this.ageYears,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.m,
        vertical: AppSpacing.s,
      ),
      color: context.colors.accent.withAlpha(25),
      child: Row(
        children: [
          Icon(Icons.child_care, color: context.colors.accent, size: 18),
          const SizedBox(width: AppSpacing.s),
          Expanded(
            child: Text(
              'Child safety mode — $memberName ($ageYears y). '
              'Stricter sodium, sugar, and additive thresholds apply.',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w500,
                color: context.colors.accent,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
