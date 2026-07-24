import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/design_system/app_palette.dart';
import '../../core/design_system/tokens.dart';
import '../../core/network/api_client.dart';

class EnergyAdjustmentCard extends ConsumerStatefulWidget {
  const EnergyAdjustmentCard({
    required this.tdeeKcal,
    required this.activityLevel,
    super.key,
  });

  final int tdeeKcal;
  final String activityLevel;

  @override
  ConsumerState<EnergyAdjustmentCard> createState() => _EnergyAdjustmentCardState();
}

class _EnergyAdjustmentCardState extends ConsumerState<EnergyAdjustmentCard> {
  _AdjustmentData? _data;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final api  = ref.read(apiClientProvider);
      final date = DateTime.now().toUtc().toIso8601String().substring(0, 10);
      final resp = await api.get<Map<String, dynamic>>(
        '/api/v1/health/energy-adjustment',
        params: {
          'tdee':          widget.tdeeKcal.toString(),
          'activityLevel': widget.activityLevel,
          'date':          date,
        },
      );
      final d = resp.data ?? {};
      if (mounted) {
        setState(() {
          _data = _AdjustmentData(
            adjustmentKcal:     d['adjustmentKcal']     as int? ?? 0,
            adjustedBudgetKcal: d['adjustedBudgetKcal'] as int? ?? widget.tdeeKcal,
            explanation:        d['explanation']         as String? ?? '',
            cappedAtMaximum:    d['cappedAtMaximum']    as bool? ?? false,
          );
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Card(
        child: SizedBox(
          height: 80,
          child: Center(child: CircularProgressIndicator()),
        ),
      );
    }

    if (_data == null || _data!.adjustmentKcal == 0) return const SizedBox.shrink();

    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.local_fire_department, color: Colors.orange),
                const SizedBox(width: 8),
                Text(
                  'Activity Bonus',
                  style: AppType.titleMedium.copyWith(fontWeight: FontWeight.bold),
                ),
                if (_data!.cappedAtMaximum) ...[
                  const SizedBox(width: 6),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: Colors.orange.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: const Text('Capped', style: AppType.labelSmall),
                  ),
                ],
                const Spacer(),
                Text(
                  '+${_data!.adjustmentKcal} kcal',
                  style: TextStyle(
                    color: context.colors.primary,
                    fontWeight: FontWeight.bold,
                    fontSize: 18,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              'Adjusted budget: ${_data!.adjustedBudgetKcal} kcal',
              style: const TextStyle(fontWeight: FontWeight.w500),
            ),
            const SizedBox(height: 4),
            Text(
              _data!.explanation,
              style: AppType.bodySmall.copyWith(color: context.colors.subtle),
            ),
          ],
        ),
      ),
    );
  }
}

class _AdjustmentData {
  const _AdjustmentData({
    required this.adjustmentKcal,
    required this.adjustedBudgetKcal,
    required this.explanation,
    required this.cappedAtMaximum,
  });
  final int    adjustmentKcal;
  final int    adjustedBudgetKcal;
  final String explanation;
  final bool   cappedAtMaximum;
}
