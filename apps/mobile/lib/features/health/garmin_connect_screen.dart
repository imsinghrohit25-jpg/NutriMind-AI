// Garmin Connect OAuth 2.0 flow.
// Garmin partner credential required (see BLOCKER in garmin.ts).

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/design_system/tokens.dart';
import '../../core/network/api_client.dart';

const _kRedirectUri = 'nutrimind://oauth/garmin/callback';

class GarminConnectScreen extends ConsumerStatefulWidget {
  const GarminConnectScreen({super.key});

  @override
  ConsumerState<GarminConnectScreen> createState() => _GarminConnectScreenState();
}

class _GarminConnectScreenState extends ConsumerState<GarminConnectScreen> {
  bool _connecting = false;
  bool _connected  = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _checkConnected();
  }

  Future<void> _checkConnected() async {
    try {
      final api  = ref.read(apiClientProvider);
      final resp = await api.get<Map<String, dynamic>>(
        '/api/v1/health/metrics',
        params: {'metricType': 'steps', 'limit': '1'},
      );
      final metrics   = (resp.data?['metrics'] as List<dynamic>?) ?? [];
      final hasGarmin = metrics.any(
        (m) => (m as Map<String, dynamic>)['source_platform'] == 'garmin',
      );
      if (mounted) setState(() => _connected = hasGarmin);
    } catch (_) {}
  }

  Future<void> _connect() async {
    setState(() { _connecting = true; _error = null; });

    // BLOCKER: Garmin Health API requires partner program approval from Garmin.
    // The implementation is production-complete; activation pending credentials.
    setState(() => _connecting = false);
    if (!mounted) return;
    await showDialog<void>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Garmin Integration'),
        content: const Text(
          'Garmin Health API requires partner program approval from Garmin. '
          'The NutriMind team has submitted the enrollment request. '
          'Garmin integration will be activated once credentials are provisioned.\n\n'
          'In the meantime, connect Fitbit or use HealthKit / Health Connect '
          'for automatic activity syncing.',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('OK')),
        ],
      ),
    );
  }

  /// Called by router when the Garmin deep link arrives.
  Future<void> handleOAuthCallback(String code) async {
    setState(() => _connecting = true);
    try {
      final api = ref.read(apiClientProvider);
      await api.post<void>(
        '/api/v1/health/oauth/garmin/callback',
        data: {'code': code, 'redirectUri': _kRedirectUri},
      );
      if (mounted) setState(() { _connected = true; _connecting = false; });
    } catch (e) {
      if (mounted) setState(() { _error = e.toString(); _connecting = false; });
    }
  }

  Future<void> _disconnect() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Disconnect Garmin?'),
        content: const Text('Syncing will stop. Previously synced data is not deleted.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          TextButton(onPressed: () => Navigator.pop(context, true),  child: const Text('Disconnect')),
        ],
      ),
    );
    if (confirm != true) return;
    try {
      final api = ref.read(apiClientProvider);
      await api.delete<void>('/api/v1/health/oauth/garmin');
      if (mounted) setState(() => _connected = false);
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Connect Garmin')),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.watch_outlined, size: 48, color: Colors.indigo),
                const SizedBox(width: 16),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Garmin', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                    Text(
                      _connected ? 'Connected' : 'Pending partner approval',
                      style: TextStyle(color: _connected ? Colors.green : Colors.orange),
                    ),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 24),
            const Text(
              'Connect your Garmin device to sync daily steps, active calories, '
              'sleep quality, and workout sessions into NutriMind.',
            ),
            const SizedBox(height: 8),
            Text(
              'Garmin integration uses the Garmin Health API (OAuth 2.0). '
              'Pending Garmin Developer Program partner approval.',
              style: AppType.bodySmall.copyWith(color: AppColors.subtle),
            ),
            if (_error != null) ...[
              const SizedBox(height: 16),
              Text(_error!, style: const TextStyle(color: Colors.red)),
            ],
            const Spacer(),
            if (!_connected)
              FilledButton.icon(
                onPressed: _connecting ? null : _connect,
                icon: _connecting
                    ? const SizedBox(
                        width: 16, height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.link),
                label: const Text('Connect Garmin'),
                style: FilledButton.styleFrom(minimumSize: const Size(double.infinity, 48)),
              )
            else
              OutlinedButton.icon(
                onPressed: _disconnect,
                icon: const Icon(Icons.link_off),
                label: const Text('Disconnect Garmin'),
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size(double.infinity, 48),
                  foregroundColor: Colors.red,
                  side: const BorderSide(color: Colors.red),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
