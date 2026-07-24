// Meal Plan screen — shows the user's current active plan and lets them generate a new one.

import '../../core/design_system/components/app_loader.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/design_system/app_palette.dart';
import '../../core/design_system/tokens.dart';
import '../../core/network/api_client.dart';
import 'grocery_list_screen.dart';

class MealPlanScreen extends ConsumerStatefulWidget {
  const MealPlanScreen({super.key});

  @override
  ConsumerState<MealPlanScreen> createState() => _MealPlanScreenState();
}

class _MealPlanScreenState extends ConsumerState<MealPlanScreen> {
  bool _loading = false;
  bool _generating = false;
  Map<String, dynamic>? _activePlan;
  List<Map<String, dynamic>> _items = [];
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadPlans();
  }

  Future<void> _loadPlans() async {
    setState(() { _loading = true; _error = null; });
    try {
      final api  = ref.read(apiClientProvider);
      final resp = await api.get<Map<String, dynamic>>('/v1/planner/plans');
      final plans = (resp.data?['plans'] as List<dynamic>? ?? [])
          .map((p) => p as Map<String, dynamic>)
          .toList();
      if (mounted) {
        setState(() => _loading = false);
        if (plans.isNotEmpty) await _loadPlan(plans.first['id'] as String);
      }
    } catch (e) {
      if (mounted) setState(() { _error = e.toString(); _loading = false; });
    }
  }

  Future<void> _loadPlan(String planId) async {
    try {
      final api  = ref.read(apiClientProvider);
      final resp = await api.get<Map<String, dynamic>>('/v1/planner/plans/$planId');
      if (mounted) {
        setState(() {
          _activePlan = resp.data?['plan'] as Map<String, dynamic>?;
          _items = (resp.data?['items'] as List<dynamic>? ?? [])
              .map((i) => i as Map<String, dynamic>)
              .toList();
        });
      }
    } catch (_) {}
  }

  Future<void> _markComplete(String itemId) async {
    try {
      final api = ref.read(apiClientProvider);
      await api.patch<void>('/v1/planner/items/$itemId/complete', data: {});
      setState(() {
        final idx = _items.indexWhere((i) => i['id'] == itemId);
        if (idx >= 0) _items[idx] = {..._items[idx], 'is_complete': true};
      });
    } catch (_) {}
  }

  Future<void> _generateGrocery() async {
    if (_activePlan == null) return;
    try {
      final api  = ref.read(apiClientProvider);
      final planId = _activePlan!['id'] as String;
      final resp = await api.post<Map<String, dynamic>>(
        '/v1/planner/plans/$planId/grocery',
        data: {},
      );
      final listId = resp.data?['listId'] as String?;
      if (listId != null && mounted) {
        Navigator.push(context, MaterialPageRoute(
          builder: (_) => GroceryListScreen(listId: listId),
        ));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('Error: $e')));
      }
    }
  }

  void _showGenerateDialog() {
    showDialog(context: context, builder: (_) => _GeneratePlanDialog(
      onGenerate: _handleGenerate,
    ));
  }

  Future<void> _handleGenerate(Map<String, dynamic> body) async {
    setState(() { _generating = true; _error = null; });
    try {
      final api  = ref.read(apiClientProvider);
      final resp = await api.post<Map<String, dynamic>>(
        '/v1/planner/generate',
        data: body,
      );
      final planId = resp.data?['planId'] as String?;
      if (planId != null && mounted) {
        await _loadPlans();
        await _loadPlan(planId);
      }
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _generating = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Meal Planner'),
        actions: [
          IconButton(
            icon: const Icon(Icons.add),
            tooltip: 'Generate Plan',
            onPressed: _showGenerateDialog,
          ),
        ],
      ),
      body: _loading || _generating
          ? Center(child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const AppLoader(),
                const SizedBox(height: 12),
                Text(_generating ? 'Generating AI meal plan...' : 'Loading...'),
              ],
            ))
          : _error != null
              ? Center(child: Text(_error!, style: const TextStyle(color: Colors.red)))
              : _activePlan == null
                  ? Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(Icons.calendar_today, size: 64, color: Colors.grey),
                          const SizedBox(height: 16),
                          Text(
                            'No meal plans yet.\nTap + to generate a 7- or 30-day plan.',
                            style: AppType.bodySmall.copyWith(color: context.colors.subtle),
                            textAlign: TextAlign.center,
                          ),
                          const SizedBox(height: 20),
                          FilledButton(
                            onPressed: _showGenerateDialog,
                            child: const Text('Generate Meal Plan'),
                          ),
                        ],
                      ),
                    )
                  : CustomScrollView(
                      slivers: [
                        SliverToBoxAdapter(
                          child: _PlanHeader(plan: _activePlan!, onGrocery: _generateGrocery),
                        ),
                        _MealItemSliver(items: _items, onComplete: _markComplete),
                      ],
                    ),
    );
  }
}

class _PlanHeader extends StatelessWidget {
  const _PlanHeader({required this.plan, required this.onGrocery});
  final Map<String, dynamic> plan;
  final VoidCallback onGrocery;

  @override
  Widget build(BuildContext context) {
    final kcal = plan['kcal_target'];
    // Deliberately not a Row+Expanded — found on a real device that combination silently fails
    // to paint (no content, no error, no exception) specifically when it's the child of a
    // SliverToBoxAdapter in a CustomScrollView, reproduced with both themed and plain colors.
    // Stacking the button below the text sidesteps the exact widget combination that triggers it.
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      color: context.colors.primary.withValues(alpha: 0.08),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(plan['title'] as String? ?? 'Meal Plan',
              style: AppType.titleMedium.copyWith(fontWeight: FontWeight.bold)),
          Text(
            '${plan['start_date']} → ${plan['end_date']} · ${kcal ?? '–'} kcal/day',
            style: AppType.bodySmall.copyWith(color: context.colors.subtle),
          ),
          const SizedBox(height: 12),
          FilledButton.icon(
            onPressed: onGrocery,
            icon: const Icon(Icons.shopping_cart, size: 16),
            label: const Text('Grocery'),
          ),
        ],
      ),
    );
  }
}

class _MealItemSliver extends StatelessWidget {
  const _MealItemSliver({required this.items, required this.onComplete});
  final List<Map<String, dynamic>> items;
  final void Function(String) onComplete;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) {
      return SliverFillRemaining(
        hasScrollBody: false,
        child: Center(child: Text('No meals yet.', style: AppType.bodySmall.copyWith(color: context.colors.subtle))),
      );
    }

    // Group by date
    final grouped = <String, List<Map<String, dynamic>>>{};
    for (final item in items) {
      final date = item['plan_date'] as String;
      grouped.putIfAbsent(date, () => []).add(item);
    }

    final dates = grouped.keys.toList()..sort();
    // Flatten into a single widget list: a date header followed by its tiles.
    final rows = <Widget>[];
    for (final date in dates) {
      rows.add(Padding(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
        child: Text(date, style: const TextStyle(fontWeight: FontWeight.bold)),
      ));
      rows.addAll(grouped[date]!.map((item) => _MealTile(item: item, onComplete: onComplete)));
    }

    return SliverList(delegate: SliverChildListDelegate(rows));
  }
}

class _MealTile extends StatelessWidget {
  const _MealTile({required this.item, required this.onComplete});
  final Map<String, dynamic> item;
  final void Function(String) onComplete;

  static const _icons = {
    'breakfast': Icons.free_breakfast,
    'lunch':     Icons.lunch_dining,
    'dinner':    Icons.dinner_dining,
    'snack':     Icons.cookie,
  };

  @override
  Widget build(BuildContext context) {
    final mealType   = item['meal_type'] as String;
    final recipeName = item['recipe_name'] as String;
    final kcal       = item['kcal_estimate'] as int?;
    final done       = item['is_complete'] as bool? ?? false;

    return ListTile(
      leading: Icon(_icons[mealType] ?? Icons.food_bank, color: done ? Colors.grey : context.colors.primary),
      title: Text(
        recipeName,
        style: TextStyle(decoration: done ? TextDecoration.lineThrough : null),
      ),
      subtitle: Text(
        '${mealType[0].toUpperCase()}${mealType.substring(1)} · ${kcal ?? '–'} kcal',
        style: AppType.bodySmall.copyWith(color: context.colors.subtle),
      ),
      trailing: done
          ? const Icon(Icons.check_circle, color: Colors.green)
          : IconButton(
              icon: const Icon(Icons.check_circle_outline),
              onPressed: () => onComplete(item['id'] as String),
            ),
    );
  }
}

class _GeneratePlanDialog extends StatefulWidget {
  const _GeneratePlanDialog({required this.onGenerate});
  final Future<void> Function(Map<String, dynamic>) onGenerate;

  @override
  State<_GeneratePlanDialog> createState() => _GeneratePlanDialogState();
}

class _GeneratePlanDialogState extends State<_GeneratePlanDialog> {
  int    _durationDays  = 7;
  int    _kcalTarget    = 2000;
  String _dietType      = 'vegetarian';

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Generate Meal Plan'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          DropdownButtonFormField<int>(
            initialValue: _durationDays,
            decoration: const InputDecoration(labelText: 'Duration'),
            items: const [
              DropdownMenuItem(value: 7,  child: Text('7 days')),
              DropdownMenuItem(value: 14, child: Text('14 days')),
              DropdownMenuItem(value: 30, child: Text('30 days')),
            ],
            onChanged: (v) => setState(() => _durationDays = v ?? 7),
          ),
          const SizedBox(height: 8),
          DropdownButtonFormField<int>(
            initialValue: _kcalTarget,
            decoration: const InputDecoration(labelText: 'Daily target (kcal)'),
            items: const [
              DropdownMenuItem(value: 1500, child: Text('1500 kcal (deficit)')),
              DropdownMenuItem(value: 1800, child: Text('1800 kcal')),
              DropdownMenuItem(value: 2000, child: Text('2000 kcal')),
              DropdownMenuItem(value: 2500, child: Text('2500 kcal')),
            ],
            onChanged: (v) => setState(() => _kcalTarget = v ?? 2000),
          ),
          const SizedBox(height: 8),
          DropdownButtonFormField<String>(
            initialValue: _dietType,
            decoration: const InputDecoration(labelText: 'Diet type'),
            items: const [
              DropdownMenuItem(value: 'vegetarian',     child: Text('Vegetarian')),
              DropdownMenuItem(value: 'vegan',          child: Text('Vegan')),
              DropdownMenuItem(value: 'non-vegetarian', child: Text('Non-Vegetarian')),
            ],
            onChanged: (v) => setState(() => _dietType = v ?? 'vegetarian'),
          ),
        ],
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
        FilledButton(
          onPressed: () {
            Navigator.pop(context);
            widget.onGenerate({
              'startDate':    DateTime.now().toIso8601String().substring(0, 10),
              'durationDays': _durationDays,
              'kcalTarget':   _kcalTarget,
              'dietType':     _dietType,
            });
          },
          child: const Text('Generate'),
        ),
      ],
    );
  }
}
