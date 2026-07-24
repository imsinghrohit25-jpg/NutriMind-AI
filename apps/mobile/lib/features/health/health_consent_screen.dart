import '../../core/design_system/components/app_loader.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/design_system/app_palette.dart';
import '../../core/design_system/tokens.dart';
import '../../core/network/api_client.dart';

const List<_MetricEntry> _kMetrics = [
  _MetricEntry('steps',             'Steps',           Icons.directions_walk),
  _MetricEntry('active_energy',     'Active Calories', Icons.local_fire_department),
  _MetricEntry('resting_energy',    'Resting Calories',Icons.hotel),
  _MetricEntry('heart_rate',        'Heart Rate',      Icons.favorite),
  _MetricEntry('weight',            'Weight',          Icons.monitor_weight),
  _MetricEntry('sleep_duration',    'Sleep',           Icons.bedtime),
  _MetricEntry('workout',           'Workouts',        Icons.fitness_center),
  _MetricEntry('blood_glucose',     'Blood Glucose',   Icons.water_drop),
  _MetricEntry('hrv',               'HRV',             Icons.graphic_eq),
  _MetricEntry('oxygen_saturation', 'Blood Oxygen',    Icons.air),
];

class _MetricEntry {
  const _MetricEntry(this.type, this.label, this.icon);
  final String type;
  final String label;
  final IconData icon;
}

class HealthConsentScreen extends ConsumerStatefulWidget {
  const HealthConsentScreen({super.key});

  @override
  ConsumerState<HealthConsentScreen> createState() => _HealthConsentScreenState();
}

class _HealthConsentScreenState extends ConsumerState<HealthConsentScreen> {
  Map<String, bool> _consentState = {};
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final api  = ref.read(apiClientProvider);
      final resp = await api.get<Map<String, dynamic>>('/api/v1/health/consents');
      final data    = resp.data ?? {};
      final consents = data['consents'] as List<dynamic>? ?? [];
      final state = <String, bool>{};
      for (final c in consents) {
        final m = c as Map<String, dynamic>;
        state[m['metric_type'] as String] = m['granted'] as bool? ?? false;
      }
      if (mounted) setState(() { _consentState = state; _loading = false; });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _toggle(String metricType, bool grant) async {
    final api = ref.read(apiClientProvider);
    try {
      if (grant) {
        await api.post<void>('/api/v1/health/consents/grant', data: {'metricType': metricType});
      } else {
        final confirm = await showDialog<bool>(
          context: context,
          builder: (_) => AlertDialog(
            title: const Text('Revoke consent?'),
            content: const Text(
              'This will permanently delete all synced data for this metric. '
              'This cannot be undone.',
            ),
            actions: [
              TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
              TextButton(
                onPressed: () => Navigator.pop(context, true),
                child: const Text('Delete', style: TextStyle(color: Colors.red)),
              ),
            ],
          ),
        );
        if (confirm != true) return;
        await api.post<void>('/api/v1/health/consents/revoke', data: {'metricType': metricType});
      }
      if (mounted) setState(() => _consentState[metricType] = grant);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Health Data Consent')),
      body: _loading
          ? const Center(child: AppLoader())
          : ListView.separated(
              padding: const EdgeInsets.symmetric(vertical: 8),
              itemCount: _kMetrics.length,
              separatorBuilder: (_, __) => const Divider(height: 1, indent: 72),
              itemBuilder: (context, i) {
                final entry   = _kMetrics[i];
                final granted = _consentState[entry.type] ?? false;
                return SwitchListTile(
                  secondary: Icon(entry.icon, color: context.colors.primary),
                  title:    Text(entry.label),
                  subtitle: Text(
                    granted ? 'Syncing • tap to revoke & delete' : 'Not syncing',
                    style: AppType.bodySmall.copyWith(color: context.colors.subtle),
                  ),
                  value:    granted,
                  onChanged: (v) => _toggle(entry.type, v),
                );
              },
            ),
    );
  }
}
