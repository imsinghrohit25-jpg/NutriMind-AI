import '../../../core/design_system/components/app_loader.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:nutrimind_ai_agent_layer/nutrimind_ai_agent_layer.dart';

import '../../../core/design_system/app_palette.dart';
import '../../../core/design_system/tokens.dart';
import '../../../core/network/api_client.dart';

// AI Memory System transparency screen — Phase 11 (`global.p11.ai_memory_system`, §12.1
// "transparency"). Lets a user see exactly what NutriMind's memory system has derived about
// them and delete any individual fact, without contacting support. Calls GET/DELETE /v1/memory.
//
// Matches CountrySelectionScreen's split (Phase 10): a route-level widget doing real I/O, and a
// public, constructor-injected presentational view underneath it for widget testing without a
// live ApiClient.

class MemoryScreen extends ConsumerStatefulWidget {
  const MemoryScreen({super.key});

  @override
  ConsumerState<MemoryScreen> createState() => _MemoryScreenState();
}

class _MemoryScreenState extends ConsumerState<MemoryScreen> {
  late Future<List<MemoryFact>> _future;

  @override
  void initState() {
    super.initState();
    _future = _fetchFacts();
  }

  Future<List<MemoryFact>> _fetchFacts() async {
    final client = ref.read(apiClientProvider);
    final resp = await client.get<Map<String, dynamic>>('/v1/memory');
    final data = resp.data!['data'] as Map<String, dynamic>;
    return (data['facts'] as List)
        .cast<Map<String, dynamic>>()
        .map(MemoryFact.fromJson)
        .toList();
  }

  Future<void> _delete(MemoryFact fact) async {
    final client = ref.read(apiClientProvider);
    await client.delete<void>('/v1/memory/${fact.factId}');
    setState(() {
      _future = _future.then((facts) => facts.where((f) => f.factId != fact.factId).toList());
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('What NutriMind knows about me')),
      body: FutureBuilder<List<MemoryFact>>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: AppLoader());
          }
          if (snapshot.hasError) {
            return MemoryTransparencyView(facts: const [], error: snapshot.error.toString(), onDelete: _delete);
          }
          return MemoryTransparencyView(facts: snapshot.data ?? const [], onDelete: _delete);
        },
      ),
    );
  }
}

/// Public, constructor-injected view — no ApiClient/Riverpod dependency, so this is directly
/// widget-testable (see test/features/memory/memory_screen_test.dart).
class MemoryTransparencyView extends StatelessWidget {
  const MemoryTransparencyView({
    super.key,
    required this.facts,
    required this.onDelete,
    this.error,
  });

  final List<MemoryFact> facts;
  final Future<void> Function(MemoryFact fact) onDelete;
  final String? error;

  @override
  Widget build(BuildContext context) {
    if (error != null) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(AppSpacing.l),
          child: Text('Couldn’t load your memory data. Please try again.', style: AppType.bodyMedium),
        ),
      );
    }

    if (facts.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.l),
          child: Text(
            'NutriMind hasn’t learned anything about you yet — this fills in as you use the app.',
            style: AppType.bodyMedium.copyWith(color: context.colors.subtle),
            textAlign: TextAlign.center,
          ),
        ),
      );
    }

    final bySection = <String, List<MemoryFact>>{};
    for (final fact in facts) {
      bySection.putIfAbsent(fact.sectionLabel, () => []).add(fact);
    }

    return ListView(
      padding: const EdgeInsets.all(AppSpacing.m),
      children: [
        for (final entry in bySection.entries) ...[
          Padding(
            padding: const EdgeInsets.symmetric(vertical: AppSpacing.s),
            child: Text(entry.key, style: AppType.titleMedium),
          ),
          for (final fact in entry.value)
            Dismissible(
              key: ValueKey(fact.factId),
              direction: DismissDirection.endToStart,
              background: Container(
                color: AppColors.scorePoor,
                alignment: Alignment.centerRight,
                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.m),
                child: const Icon(Icons.delete, color: Colors.white),
              ),
              onDismissed: (_) => onDelete(fact),
              child: ListTile(
                title: Text(fact.factKey),
                subtitle: Text('Confidence: ${(fact.confidence * 100).round()}%'),
                trailing: IconButton(
                  icon: const Icon(Icons.delete_outline),
                  tooltip: 'Delete this',
                  onPressed: () => onDelete(fact),
                ),
              ),
            ),
        ],
      ],
    );
  }
}
