// Family Nutrition Dashboard — shows all members' daily nutrition summary
// and a shared real-time shopping list.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../core/design_system/tokens.dart';
import '../../core/network/api_client.dart';

class FamilyDashboardScreen extends ConsumerStatefulWidget {
  const FamilyDashboardScreen({super.key});

  @override
  ConsumerState<FamilyDashboardScreen> createState() => _FamilyDashboardScreenState();
}

class _FamilyDashboardScreenState extends ConsumerState<FamilyDashboardScreen> {
  bool _loading = true;
  List<Map<String, dynamic>> _groups = [];
  Map<String, dynamic>? _activeGroup;
  List<Map<String, dynamic>> _memberStats = [];
  List<Map<String, dynamic>> _shoppingItems = [];
  String? _activeListId;
  String? _error;

  // Realtime subscription
  RealtimeChannel? _channel;

  @override
  void initState() {
    super.initState();
    _loadGroups();
  }

  @override
  void dispose() {
    _channel?.unsubscribe();
    super.dispose();
  }

  Future<void> _loadGroups() async {
    setState(() { _loading = true; _error = null; });
    try {
      final api  = ref.read(apiClientProvider);
      final resp = await api.get<Map<String, dynamic>>('/api/v1/family/groups');
      final groups = (resp.data?['groups'] as List<dynamic>? ?? []).map((g) {
        final m = g as Map<String, dynamic>;
        final fg = m['family_groups'] as Map<String, dynamic>? ?? {};
        return {'id': fg['id'], 'name': fg['name'], 'role': m['role']};
      }).toList();
      if (mounted) {
        setState(() { _groups = groups; _loading = false; });
        if (groups.isNotEmpty) await _selectGroup(groups.first['id'] as String);
      }
    } catch (e) {
      if (mounted) setState(() { _error = e.toString(); _loading = false; });
    }
  }

  Future<void> _selectGroup(String groupId) async {
    setState(() => _activeGroup = _groups.firstWhere((g) => g['id'] == groupId, orElse: () => {}));
    await Future.wait([_loadDashboard(groupId), _loadShoppingList(groupId)]);
  }

  Future<void> _loadDashboard(String groupId) async {
    try {
      final api  = ref.read(apiClientProvider);
      final resp = await api.get<Map<String, dynamic>>(
        '/api/v1/family/groups/$groupId/dashboard',
      );
      if (mounted) {
        setState(() {
          _memberStats = (resp.data?['members'] as List<dynamic>? ?? [])
              .map((m) => m as Map<String, dynamic>).toList();
        });
      }
    } catch (_) {}
  }

  Future<void> _loadShoppingList(String groupId) async {
    try {
      final api  = ref.read(apiClientProvider);
      final listsResp = await api.get<Map<String, dynamic>>(
        '/api/v1/family/groups/$groupId/shopping',
      );
      final lists = (listsResp.data?['lists'] as List<dynamic>? ?? [])
          .map((l) => l as Map<String, dynamic>).toList();

      if (lists.isNotEmpty) {
        final listId = lists.first['id'] as String;
        setState(() => _activeListId = listId);
        final itemsResp = await api.get<Map<String, dynamic>>(
          '/api/v1/family/shopping/$listId/items',
        );
        if (mounted) {
          setState(() {
            _shoppingItems = (itemsResp.data?['items'] as List<dynamic>? ?? [])
                .map((i) => i as Map<String, dynamic>).toList();
          });
        }
        _subscribeRealtime(listId);
      }
    } catch (_) {}
  }

  void _subscribeRealtime(String listId) {
    _channel?.unsubscribe();
    _channel = Supabase.instance.client
        .channel('family_shopping_$listId')
        .onPostgresChanges(
          event:  PostgresChangeEvent.all,
          schema: 'public',
          table:  'family_shopping_items',
          filter: PostgresChangeFilter(type: PostgresChangeFilterType.eq, column: 'list_id', value: listId),
          callback: (_) {
            // Reload items when any change arrives
            final api = ref.read(apiClientProvider);
            api.get<Map<String, dynamic>>('/api/v1/family/shopping/$listId/items')
                .then((resp) {
              if (mounted) {
                setState(() {
                  _shoppingItems = (resp.data?['items'] as List<dynamic>? ?? [])
                      .map((i) => i as Map<String, dynamic>).toList();
                });
              }
            });
          },
        )
        .subscribe();
  }

  Future<void> _createGroup() async {
    final ctrl = TextEditingController();
    await showDialog(context: context, builder: (_) => AlertDialog(
      title: const Text('Create Family Group'),
      content: TextField(controller: ctrl, decoration: const InputDecoration(labelText: 'Group name')),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
        FilledButton(onPressed: () async {
          Navigator.pop(context);
          try {
            final api = ref.read(apiClientProvider);
            await api.post<void>('/api/v1/family/groups', data: {'name': ctrl.text.trim()});
            await _loadGroups();
          } catch (_) {}
        }, child: const Text('Create')),
      ],
    ));
  }

  Future<void> _addShoppingItem() async {
    final groupId = _activeGroup?['id'] as String?;
    if (groupId == null) return;

    final ctrl = TextEditingController();
    await showDialog(context: context, builder: (_) => AlertDialog(
      title: const Text('Add Item'),
      content: TextField(controller: ctrl, decoration: const InputDecoration(labelText: 'Item name')),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
        FilledButton(onPressed: () async {
          Navigator.pop(context);
          if (_activeListId == null) {
            // Create list first
            final api   = ref.read(apiClientProvider);
            final resp  = await api.post<Map<String, dynamic>>(
              '/api/v1/family/groups/$groupId/shopping',
              data: {'title': 'Shopping List'},
            );
            final listId = resp.data?['list']?['id'] as String?;
            if (listId != null) setState(() => _activeListId = listId);
          }
          if (_activeListId != null) {
            final api = ref.read(apiClientProvider);
            await api.post<void>(
              '/api/v1/family/shopping/$_activeListId/items',
              data: {'name': ctrl.text.trim()},
            );
          }
        }, child: const Text('Add')),
      ],
    ));
  }

  Future<void> _toggleItem(String itemId) async {
    try {
      final api = ref.read(apiClientProvider);
      await api.post<void>('/api/v1/family/shopping/items/$itemId/toggle', data: {});
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Family Dashboard'),
        actions: [
          IconButton(icon: const Icon(Icons.group_add), onPressed: _createGroup),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Text(_error!, style: const TextStyle(color: Colors.red)))
              : _groups.isEmpty
                  ? Center(child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.family_restroom, size: 64, color: Colors.grey),
                        const SizedBox(height: 16),
                        Text(
                          'No family groups yet.\nCreate one to start tracking together.',
                          textAlign: TextAlign.center,
                          style: AppType.bodySmall.copyWith(color: AppColors.subtle),
                        ),
                        const SizedBox(height: 16),
                        FilledButton(onPressed: _createGroup, child: const Text('Create Group')),
                      ],
                    ))
                  : Column(
                      children: [
                        // Group selector
                        if (_groups.length > 1)
                          SingleChildScrollView(
                            scrollDirection: Axis.horizontal,
                            padding: const EdgeInsets.all(8),
                            child: Row(
                              children: _groups.map((g) => Padding(
                                padding: const EdgeInsets.only(right: 8),
                                child: ChoiceChip(
                                  label: Text(g['name'] as String),
                                  selected: _activeGroup?['id'] == g['id'],
                                  onSelected: (_) => _selectGroup(g['id'] as String),
                                ),
                              )).toList(),
                            ),
                          ),
                        // Member nutrition summary
                        Expanded(
                          child: ListView(
                            padding: const EdgeInsets.all(12),
                            children: [
                              if (_memberStats.isNotEmpty) ...[
                                const Text('Today\'s Nutrition', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                                const SizedBox(height: 8),
                                ..._memberStats.map((m) => _MemberStatCard(stat: m)),
                                const SizedBox(height: 16),
                              ],
                              Row(
                                children: [
                                  const Text('Shopping List', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                                  const Spacer(),
                                  IconButton(icon: const Icon(Icons.add_shopping_cart), onPressed: _addShoppingItem),
                                ],
                              ),
                              if (_shoppingItems.isEmpty)
                                Padding(
                                  padding: const EdgeInsets.all(16),
                                  child: Text('No items. Tap + to add.', style: AppType.bodySmall.copyWith(color: AppColors.subtle)),
                                )
                              else
                                ..._shoppingItems.map((item) => _ShoppingItemTile(
                                  item: item,
                                  onToggle: _toggleItem,
                                )),
                            ],
                          ),
                        ),
                      ],
                    ),
    );
  }
}

class _MemberStatCard extends StatelessWidget {
  const _MemberStatCard({required this.stat});
  final Map<String, dynamic> stat;

  @override
  Widget build(BuildContext context) {
    final userId  = (stat['userId'] as String).substring(0, 8);
    final kcal    = stat['calories'] as int? ?? 0;
    final protein = (stat['protein'] as num?)?.toStringAsFixed(1) ?? '0';

    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: const CircleAvatar(child: Icon(Icons.person)),
        title: Text('User $userId...'),
        subtitle: Text('$kcal kcal · ${protein}g protein today'),
        trailing: Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          decoration: BoxDecoration(
            color: AppColors.primary.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Text('$kcal kcal', style: const TextStyle(color: AppColors.primary, fontSize: 12)),
        ),
      ),
    );
  }
}

class _ShoppingItemTile extends StatelessWidget {
  const _ShoppingItemTile({required this.item, required this.onToggle});
  final Map<String, dynamic> item;
  final Future<void> Function(String) onToggle;

  @override
  Widget build(BuildContext context) {
    final purchased = item['is_purchased'] as bool? ?? false;
    return ListTile(
      leading: Checkbox(
        value: purchased,
        onChanged: (_) => onToggle(item['id'] as String),
      ),
      title: Text(
        item['name'] as String,
        style: TextStyle(
          decoration: purchased ? TextDecoration.lineThrough : null,
          color: purchased ? AppColors.subtle : null,
        ),
      ),
      subtitle: Text(
        '${item['quantity']} ${item['unit']}',
        style: AppType.bodySmall.copyWith(color: AppColors.subtle),
      ),
    );
  }
}
