// Fitbit OAuth 2.0 PKCE connect flow.
// Launches system browser → redirects back via deep link → exchanges code server-side.

import 'dart:convert';
import 'dart:math';
import 'package:crypto/crypto.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/design_system/tokens.dart';
import '../../core/network/api_client.dart';

const _kFitbitClientId = String.fromEnvironment('FITBIT_CLIENT_ID');
const _kRedirectUri    = 'nutrimind://oauth/fitbit/callback';

String _generateCodeVerifier() {
  final rand  = Random.secure();
  final bytes = List<int>.generate(32, (_) => rand.nextInt(256));
  return base64UrlEncode(bytes).replaceAll('=', '');
}

String _generateCodeChallenge(String verifier) {
  final bytes  = utf8.encode(verifier);
  final digest = sha256.convert(bytes);
  return base64UrlEncode(digest.bytes).replaceAll('=', '');
}

class FitbitConnectScreen extends ConsumerStatefulWidget {
  const FitbitConnectScreen({super.key});

  @override
  ConsumerState<FitbitConnectScreen> createState() => _FitbitConnectScreenState();
}

class _FitbitConnectScreenState extends ConsumerState<FitbitConnectScreen> {
  bool _connecting = false;
  bool _connected  = false;
  String? _error;

  late final String _codeVerifier;
  late final String _codeChallenge;

  @override
  void initState() {
    super.initState();
    _codeVerifier  = _generateCodeVerifier();
    _codeChallenge = _generateCodeChallenge(_codeVerifier);
    _checkConnected();
  }

  Future<void> _checkConnected() async {
    try {
      final api  = ref.read(apiClientProvider);
      final resp = await api.get<Map<String, dynamic>>('/api/v1/health/consents');
      final consents = (resp.data?['consents'] as List<dynamic>?) ?? [];
      final hasAny = consents.any((c) => (c as Map<String, dynamic>)['granted'] == true);
      if (mounted) setState(() => _connected = hasAny);
    } catch (_) {}
  }

  Future<void> _connect() async {
    setState(() { _connecting = true; _error = null; });

    const scopes = 'activity heartrate sleep weight profile';
    final uri = Uri.https('www.fitbit.com', '/oauth2/authorize', {
      'client_id':             _kFitbitClientId,
      'redirect_uri':          _kRedirectUri,
      'scope':                 scopes,
      'response_type':         'code',
      'code_challenge':        _codeChallenge,
      'code_challenge_method': 'S256',
    });

    if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) {
      if (mounted) {
        setState(() { _connecting = false; _error = 'Could not open browser.'; });
      }
      return;
    }

    if (mounted) setState(() => _connecting = false);
  }

  /// Called by the router when the deep link arrives.
  Future<void> handleOAuthCallback(String code) async {
    setState(() => _connecting = true);
    try {
      final api = ref.read(apiClientProvider);
      await api.post<void>(
        '/api/v1/health/oauth/fitbit/callback',
        data: {
          'code':         code,
          'redirectUri':  _kRedirectUri,
          'codeVerifier': _codeVerifier,
        },
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
        title: const Text('Disconnect Fitbit?'),
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
      await api.delete<void>('/api/v1/health/oauth/fitbit');
      if (mounted) setState(() => _connected = false);
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Connect Fitbit')),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.watch, size: 48, color: Colors.teal),
                const SizedBox(width: 16),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Fitbit', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                    Text(
                      _connected ? 'Connected' : 'Not connected',
                      style: TextStyle(color: _connected ? Colors.green : AppColors.subtle),
                    ),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 24),
            const Text(
              'NutriMind will sync steps, calories, heart rate, '
              'sleep, and weight from your Fitbit to personalise your nutrition targets.',
            ),
            const SizedBox(height: 8),
            Text(
              'Data is fetched server-side using OAuth 2.0 PKCE. '
              'You can revoke access at any time.',
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
                label: const Text('Connect Fitbit'),
                style: FilledButton.styleFrom(minimumSize: const Size(double.infinity, 48)),
              )
            else
              OutlinedButton.icon(
                onPressed: _disconnect,
                icon: const Icon(Icons.link_off),
                label: const Text('Disconnect Fitbit'),
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
