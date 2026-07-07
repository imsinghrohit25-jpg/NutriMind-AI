import 'package:flutter/material.dart';
import '../../core/design_system/tokens.dart';

/// Disease-specific guidance chips shown below the health score.
/// Each chip expands to show cited guidance text and regulatory citation.
/// Output-policy: text is informational only, no diagnosis/cure language.

class DiseaseChipsWidget extends StatelessWidget {
  final List<dynamic> diseaseRuleResults; // DiseaseRuleResult[] from API

  const DiseaseChipsWidget({super.key, required this.diseaseRuleResults});

  @override
  Widget build(BuildContext context) {
    final triggered = diseaseRuleResults
        .whereType<Map<String, dynamic>>()
        .where((r) => r['triggered'] == true)
        .toList();

    if (triggered.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Health condition notes', style: AppType.labelMedium),
        const SizedBox(height: AppSpacing.xs),
        ...triggered.map((r) => _DiseaseChip(result: r)),
      ],
    );
  }
}

class _DiseaseChip extends StatefulWidget {
  final Map<String, dynamic> result;
  const _DiseaseChip({required this.result});

  @override
  State<_DiseaseChip> createState() => _DiseaseChipState();
}

class _DiseaseChipState extends State<_DiseaseChip> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final severity    = widget.result['severity'] as String? ?? 'caution';
    final message     = widget.result['message'] as String? ?? '';
    final citationIds = (widget.result['citationIds'] as List<dynamic>?)
        ?.cast<String>() ?? [];
    final color       = severity == 'warning' ? AppColors.scorePoor : AppColors.warning;

    return Container(
      margin: const EdgeInsets.only(bottom: AppSpacing.s),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withAlpha(100)),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(8),
        onTap: () => setState(() => _expanded = !_expanded),
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.m),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(children: [
                Icon(
                  severity == 'warning'
                      ? Icons.medical_services_outlined
                      : Icons.health_and_safety_outlined,
                  color: color,
                  size: 16,
                ),
                const SizedBox(width: AppSpacing.xs),
                Expanded(
                  child: Text(
                    _shortLabel(severity),
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: color,
                    ),
                  ),
                ),
                Icon(
                  _expanded ? Icons.keyboard_arrow_up : Icons.keyboard_arrow_down,
                  size: 16,
                  color: AppColors.subtle,
                ),
              ]),
              if (_expanded) ...[
                const SizedBox(height: AppSpacing.s),
                Text(message, style: const TextStyle(fontSize: 12)),
                if (citationIds.isNotEmpty) ...[
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    'Source: ${citationIds.join(', ')}',
                    style: const TextStyle(
                      fontSize: 11,
                      color: AppColors.subtle,
                      fontStyle: FontStyle.italic,
                    ),
                  ),
                ],
                const SizedBox(height: AppSpacing.xs),
                const Text(
                  'This is general nutrition information, not medical advice. Consult your doctor for personalised guidance.',
                  style: TextStyle(fontSize: 11, color: AppColors.subtle),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  String _shortLabel(String severity) =>
      severity == 'warning' ? 'Health note — review before consuming' : 'Health consideration';
}
