import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/design_system/app_palette.dart';
import '../../core/design_system/tokens.dart';
import '../../core/network/api_client.dart';

class HealthDashboardWidget extends ConsumerStatefulWidget {
  const HealthDashboardWidget({super.key});

  @override
  ConsumerState<HealthDashboardWidget> createState() => _HealthDashboardWidgetState();
}

class _HealthDashboardWidgetState extends ConsumerState<HealthDashboardWidget> {
  List<_MetricSummary> _metrics = [];
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
        '/api/v1/health/metrics',
        params: {
          'from':  '${date}T00:00:00Z',
          'to':    '${date}T23:59:59Z',
          'limit': '500',
        },
      );
      final data       = resp.data ?? {};
      final rawMetrics = data['metrics'] as List<dynamic>? ?? [];

      final Map<String, List<double>> byType = {};
      for (final m in rawMetrics) {
        final row   = m as Map<String, dynamic>;
        final type  = row['metric_type'] as String;
        final value = (row['value'] as num).toDouble();
        byType.putIfAbsent(type, () => []).add(value);
      }

      final summaries = <_MetricSummary>[];
      for (final entry in byType.entries) {
        final type   = entry.key;
        final values = entry.value;
        final isAvg  = type == 'heart_rate' || type == 'oxygen_saturation' || type == 'hrv';
        final value  = isAvg
            ? values.reduce((a, b) => a + b) / values.length
            : values.reduce((a, b) => a + b);
        summaries.add(_MetricSummary(type: type, value: value, isAvg: isAvg));
      }

      if (mounted) setState(() { _metrics = summaries; _loading = false; });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const SizedBox(height: 120, child: Center(child: CircularProgressIndicator()));
    }

    if (_metrics.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Text(
            "Today's Health",
            style: AppType.titleMedium.copyWith(fontWeight: FontWeight.bold),
          ),
        ),
        SizedBox(
          height: 100,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            itemCount: _metrics.length,
            separatorBuilder: (_, __) => const SizedBox(width: 12),
            itemBuilder: (context, i) => _MetricChip(summary: _metrics[i]),
          ),
        ),
      ],
    );
  }
}

class _MetricSummary {
  const _MetricSummary({required this.type, required this.value, required this.isAvg});
  final String type;
  final double value;
  final bool isAvg;
}

class _MetricChip extends StatelessWidget {
  const _MetricChip({required this.summary});
  final _MetricSummary summary;

  String get _label {
    switch (summary.type) {
      case 'steps':             return 'Steps';
      case 'active_energy':     return 'Active cal';
      case 'resting_energy':    return 'Resting cal';
      case 'heart_rate':        return 'Heart rate';
      case 'weight':            return 'Weight';
      case 'sleep_duration':    return 'Sleep';
      case 'workout':           return 'Workout';
      case 'blood_glucose':     return 'Glucose';
      case 'hrv':               return 'HRV';
      case 'oxygen_saturation': return 'SpO₂';
      default:                  return summary.type;
    }
  }

  String get _unit {
    switch (summary.type) {
      case 'steps':             return '';
      case 'active_energy':     return ' kcal';
      case 'resting_energy':    return ' kcal';
      case 'heart_rate':        return ' bpm';
      case 'weight':            return ' kg';
      case 'sleep_duration':    return ' min';
      case 'workout':           return ' min';
      case 'blood_glucose':     return ' mg/dL';
      case 'hrv':               return ' ms';
      case 'oxygen_saturation': return '%';
      default:                  return '';
    }
  }

  IconData get _icon {
    switch (summary.type) {
      case 'steps':             return Icons.directions_walk;
      case 'active_energy':     return Icons.local_fire_department;
      case 'resting_energy':    return Icons.hotel;
      case 'heart_rate':        return Icons.favorite;
      case 'weight':            return Icons.monitor_weight;
      case 'sleep_duration':    return Icons.bedtime;
      case 'workout':           return Icons.fitness_center;
      case 'blood_glucose':     return Icons.water_drop;
      case 'hrv':               return Icons.graphic_eq;
      case 'oxygen_saturation': return Icons.air;
      default:                  return Icons.show_chart;
    }
  }

  @override
  Widget build(BuildContext context) {
    final v = summary.isAvg
        ? summary.value.toStringAsFixed(1)
        : summary.value.toStringAsFixed(0);
    return Container(
      width: 88,
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: context.colors.primary.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(_icon, color: context.colors.primary, size: 20),
          const SizedBox(height: 4),
          Text(
            '$v$_unit',
            style: AppType.titleSmall.copyWith(fontWeight: FontWeight.bold),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 2),
          Text(
            _label,
            style: AppType.bodySmall.copyWith(color: context.colors.subtle),
            textAlign: TextAlign.center,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }
}
