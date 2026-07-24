import '../../core/design_system/components/app_loader.dart';
import 'package:flutter/material.dart';
import '../../core/design_system/app_palette.dart';
import '../../core/design_system/tokens.dart';

/// History semantic search screen — lets users search past scans by natural language.
/// E.g. "snacks with high sodium" or "products I scanned last month with good scores".
/// Gate requirement: history semantic search works.
class HistorySearchScreen extends StatefulWidget {
  /// Callback that performs the search (calls API) and returns results.
  /// Signature: Future<List<Map<String, dynamic>>> search(String query)
  final Future<List<Map<String, dynamic>>> Function(String query) onSearch;

  const HistorySearchScreen({super.key, required this.onSearch});

  @override
  State<HistorySearchScreen> createState() => _HistorySearchScreenState();
}

class _HistorySearchScreenState extends State<HistorySearchScreen> {
  final _controller = TextEditingController();
  List<Map<String, dynamic>> _results = [];
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _search() async {
    final query = _controller.text.trim();
    if (query.isEmpty) return;

    setState(() { _loading = true; _error = null; });
    try {
      final results = await widget.onSearch(query);
      setState(() { _results = results; });
    } catch (e) {
      setState(() { _error = 'Search failed. Please try again.'; });
    } finally {
      setState(() { _loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Search History')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(AppSpacing.m),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _controller,
                    decoration: const InputDecoration(
                      hintText: 'e.g. high sodium snacks, low score biscuits',
                      prefixIcon: Icon(Icons.search),
                      border: OutlineInputBorder(),
                    ),
                    textInputAction: TextInputAction.search,
                    onSubmitted: (_) => _search(),
                  ),
                ),
                const SizedBox(width: AppSpacing.s),
                FilledButton(
                  onPressed: _loading ? null : _search,
                  child: const Text('Search'),
                ),
              ],
            ),
          ),

          if (_loading)
            const Padding(
              padding: EdgeInsets.all(AppSpacing.m),
              child: AppLoader(),
            )
          else if (_error != null)
            Padding(
              padding: const EdgeInsets.all(AppSpacing.m),
              child: Text(_error!, style: AppType.bodyMedium.copyWith(color: AppColors.scorePoor)),
            )
          else
            Expanded(
              child: _results.isEmpty
                  ? const _EmptyState()
                  : ListView.builder(
                      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.m),
                      itemCount: _results.length,
                      itemBuilder: (ctx, i) => _HistoryResultCard(result: _results[i]),
                    ),
            ),
        ],
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.history, size: 48, color: context.colors.subtle),
          const SizedBox(height: AppSpacing.s),
          Text('Search your scan history', style: AppType.bodyMedium.copyWith(color: context.colors.subtle)),
        ],
      ),
    );
  }
}

class _HistoryResultCard extends StatelessWidget {
  final Map<String, dynamic> result;

  const _HistoryResultCard({required this.result});

  @override
  Widget build(BuildContext context) {
    final name       = result['productName'] as String? ?? 'Unknown';
    final score      = (result['healthScore'] as num?)?.toDouble() ?? 0;
    final band       = result['band'] as String? ?? '';
    final scannedAt  = result['scannedAt'] as String? ?? '';
    final similarity = (result['similarity'] as num?)?.toDouble() ?? 0;
    final category   = result['category'] as String?;

    final scoreColor = score >= 80 ? AppColors.scoreExcellent
        : score >= 60 ? AppColors.scoreGood
        : score >= 40 ? AppColors.scoreFair
        : AppColors.scorePoor;

    return Card(
      margin: const EdgeInsets.only(bottom: AppSpacing.s),
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: scoreColor.withValues(alpha: 0.15),
          child: Text(
            score.toStringAsFixed(0),
            style: AppType.bodyMedium.copyWith(color: scoreColor, fontWeight: FontWeight.bold),
          ),
        ),
        title: Text(name, style: AppType.bodyMedium),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '${band.toUpperCase()}${category != null ? ' · $category' : ''}',
              style: AppType.bodySmall.copyWith(color: context.colors.subtle),
            ),
            Text(
              'Scanned: ${scannedAt.length >= 10 ? scannedAt.substring(0, 10) : scannedAt}',
              style: AppType.bodySmall.copyWith(color: context.colors.subtle),
            ),
          ],
        ),
        trailing: Tooltip(
          message: 'Relevance: ${(similarity * 100).toStringAsFixed(0)}%',
          child: Text(
            '${(similarity * 100).toStringAsFixed(0)}%',
            style: AppType.bodySmall.copyWith(color: context.colors.subtle),
          ),
        ),
      ),
    );
  }
}
