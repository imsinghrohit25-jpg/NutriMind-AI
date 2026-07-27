import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_client.dart';

/// Parses the `GET /v1/history/search` response into the result maps HistorySearchScreen renders
/// (productName / healthScore / band / scannedAt / similarity / category). Pure + tested.
List<Map<String, dynamic>> parseHistoryResults(Map<String, dynamic> body) {
  final data = body['data'] is Map<String, dynamic> ? body['data'] as Map<String, dynamic> : body;
  return (data['results'] as List?)?.whereType<Map<String, dynamic>>().toList() ??
      const <Map<String, dynamic>>[];
}

/// Semantic search over the user's scan history — the `onSearch` callback HistorySearchScreen
/// expects. Calls the existing `GET /v1/history/search` (embed query → match_scan_history RPC).
Future<List<Map<String, dynamic>>> searchScanHistory(WidgetRef ref, String query) async {
  final client = ref.read(apiClientProvider);
  final resp = await client.get<Map<String, dynamic>>('/v1/history/search', params: {'q': query});
  return parseHistoryResults(resp.data ?? const <String, dynamic>{});
}
