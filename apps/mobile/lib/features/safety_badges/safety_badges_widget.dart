import 'package:flutter/material.dart';
import '../../core/design_system/tokens.dart';

/// Safety badge strip shown prominently on the product screen.
/// Allergen warnings marked 'unsuppressible' CANNOT be dismissed by the user.
/// Possible/trace warnings can be dismissed per session but reappear on next scan.

class SafetyBadgesWidget extends StatefulWidget {
  final List<dynamic> allergenMatches;   // AllergenMatch[] from API
  final List<dynamic> childWarnings;     // ChildSafetyWarning[] from API
  final bool hasFailSafe;
  final String? failSafeReason;

  const SafetyBadgesWidget({
    super.key,
    required this.allergenMatches,
    required this.childWarnings,
    this.hasFailSafe = false,
    this.failSafeReason,
  });

  @override
  State<SafetyBadgesWidget> createState() => _SafetyBadgesWidgetState();
}

class _SafetyBadgesWidgetState extends State<SafetyBadgesWidget> {
  // Track dismissed 'possible' allergen IDs (per session only)
  final Set<String> _dismissed = {};

  @override
  Widget build(BuildContext context) {
    final allergens = widget.allergenMatches
        .whereType<Map<String, dynamic>>()
        .toList();
    final childWarnings = widget.childWarnings
        .whereType<Map<String, dynamic>>()
        .toList();

    final visible = allergens.where((m) {
      final id           = m['allergenId'] as String? ?? '';
      final unsuppressible = m['unsuppressible'] == true;
      if (unsuppressible) return true;
      return !_dismissed.contains(id);
    }).toList();

    if (visible.isEmpty && childWarnings.isEmpty && !widget.hasFailSafe) {
      return const SizedBox.shrink();
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Fail-safe banner (highest priority)
        if (widget.hasFailSafe)
          _FailSafeBanner(reason: widget.failSafeReason),

        // Allergen warnings
        ...visible.map((m) => _AllergenBadge(
          match: m,
          onDismiss: m['unsuppressible'] == true
              ? null
              : () => setState(() => _dismissed.add(m['allergenId'] as String? ?? '')),
        )),

        // Child safety warnings
        ...childWarnings.map((w) => _ChildWarningBadge(warning: w)),
      ],
    );
  }
}

// ── Fail-safe banner ────────────────────────────────────────────────────────────

class _FailSafeBanner extends StatelessWidget {
  final String? reason;
  const _FailSafeBanner({this.reason});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: AppSpacing.s),
      padding: const EdgeInsets.all(AppSpacing.m),
      decoration: BoxDecoration(
        color: AppColors.error.withAlpha(20),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.error),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.warning_rounded, color: AppColors.error, size: 20),
          const SizedBox(width: AppSpacing.s),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Allergen information may be incomplete',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: AppColors.error,
                  ),
                ),
                if (reason != null) ...[
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    reason!,
                    style: const TextStyle(fontSize: 12, color: AppColors.error),
                  ),
                ],
                const SizedBox(height: AppSpacing.xs),
                const Text(
                  'Check the physical label carefully before consuming if you have food allergies.',
                  style: TextStyle(fontSize: 12, color: AppColors.error),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ── Allergen badge ───────────────────────────────────────────────────────────────

class _AllergenBadge extends StatelessWidget {
  final Map<String, dynamic> match;
  final VoidCallback? onDismiss;

  const _AllergenBadge({required this.match, this.onDismiss});

  @override
  Widget build(BuildContext context) {
    final displayName    = match['displayName'] as String? ?? 'Allergen';
    final matchType      = match['matchType'] as String? ?? 'declared';
    final unsuppressible = match['unsuppressible'] == true;
    final color          = matchType == 'declared' ? AppColors.scoreBad : AppColors.warning;

    return Container(
      margin: const EdgeInsets.only(bottom: AppSpacing.s),
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.m,
        vertical: AppSpacing.s,
      ),
      decoration: BoxDecoration(
        color: color.withAlpha(20),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withAlpha(120)),
      ),
      child: Row(
        children: [
          Icon(
            unsuppressible ? Icons.no_food_outlined : Icons.info_outline,
            color: color,
            size: 18,
          ),
          const SizedBox(width: AppSpacing.s),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _badgeTitle(matchType, displayName),
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: color,
                  ),
                ),
                Text(
                  _badgeSubtitle(matchType),
                  style: TextStyle(fontSize: 12, color: color),
                ),
              ],
            ),
          ),
          if (onDismiss != null)
            IconButton(
              icon: const Icon(Icons.close, size: 16),
              onPressed: onDismiss,
              color: color,
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(),
            ),
        ],
      ),
    );
  }

  String _badgeTitle(String matchType, String name) {
    switch (matchType) {
      case 'declared': return 'Contains $name';
      case 'trace':    return 'May contain $name (trace)';
      default:         return 'Possible $name cross-contamination';
    }
  }

  String _badgeSubtitle(String matchType) {
    switch (matchType) {
      case 'declared':
        return 'Declared in ingredient list. This warning cannot be dismissed.';
      case 'trace':
        return '"May contain" or facility notice on label. This warning cannot be dismissed.';
      default:
        return 'Facility language detected; specific allergen not confirmed.';
    }
  }
}

// ── Child safety warning badge ───────────────────────────────────────────────────

class _ChildWarningBadge extends StatelessWidget {
  final Map<String, dynamic> warning;
  const _ChildWarningBadge({required this.warning});

  @override
  Widget build(BuildContext context) {
    final severity = warning['severity'] as String? ?? 'caution';
    final message  = warning['message'] as String? ?? '';
    final color    = severity == 'warning' ? AppColors.scorePoor : AppColors.warning;

    return Container(
      margin: const EdgeInsets.only(bottom: AppSpacing.s),
      padding: const EdgeInsets.all(AppSpacing.m),
      decoration: BoxDecoration(
        color: color.withAlpha(20),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withAlpha(120)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.child_care_outlined, color: color, size: 18),
          const SizedBox(width: AppSpacing.s),
          Expanded(
            child: Text(message, style: TextStyle(fontSize: 12, color: color)),
          ),
        ],
      ),
    );
  }
}
