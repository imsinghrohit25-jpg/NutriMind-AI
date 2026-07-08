// Grocery List screen — shows categorised grocery items with purchase toggle.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/design_system/tokens.dart';
import '../../core/network/api_client.dart';

class GroceryListScreen extends ConsumerStatefulWidget {
  const GroceryListScreen({super.key, required this.listId});
  final String listId;

  @override
  ConsumerState<GroceryListScreen> createState() => _GroceryListScreenState();
}

class _GroceryListScreenState extends ConsumerState<GroceryListScreen> {
  bool _loading = true;
  Map<String, dynamic>? _list;
  List<Map<String, dynamic>> _items = [];
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final api  = ref.read(apiClientProvider);
      final resp = await api.get<Map<String, dynamic>>('/api/v1/planner/grocery/${widget.listId}');
      if (mounted) {
        setState(() {
          _list    = resp.data?['list'] as Map<String, dynamic>?;
          _items   = (resp.data?['items'] as List<dynamic>? ?? [])
              .map((i) => i as Map<String, dynamic>)
              .toList();
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() { _error = e.toString(); _loading = false; });
    }
  }

  Future<void> _toggle(String itemId) async {
    try {
      final api = ref.read(apiClientProvider);
      await api.post<void>('/api/v1/planner/grocery/items/$itemId/toggle', data: {});
      final idx = _items.indexWhere((i) => i['id'] == itemId);
      if (idx >= 0 && mounted) {
        setState(() {
          _items[idx] = {
            ..._items[idx],
            'is_purchased': !(_items[idx]['is_purchased'] as bool? ?? false),
          };
        });
      }
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Scaffold(body: Center(child: CircularProgressIndicator()));
    if (_error != null) return Scaffold(body: Center(child: Text(_error!)));

    final grouped = <String, List<Map<String, dynamic>>>{};
    for (final item in _items) {
      final cat = item['category'] as String? ?? 'other';
      grouped.putIfAbsent(cat, () => []).add(item);
    }
    final purchased = _items.where((i) => i['is_purchased'] == true).length;
    final totalPrice = _items.fold<num>(0, (s, i) => s + ((i['estimated_price'] as num?) ?? 0));
    final currencySymbol = _currencySymbol(
      _items.isNotEmpty ? _items.first['currency_code'] as String? : null,
    );

    final categories = grouped.keys.toList()
      ..sort((a, b) {
        const order = ['produce', 'dairy', 'protein', 'legumes', 'grains', 'oil', 'nuts', 'spices', 'other'];
        return order.indexOf(a) - order.indexOf(b);
      });

    return Scaffold(
      appBar: AppBar(title: Text(_list?['title'] as String? ?? 'Grocery List')),
      body: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            color: AppColors.primary.withValues(alpha: 0.08),
            child: Row(
              children: [
                Text(
                  '$purchased / ${_items.length} items',
                  style: const TextStyle(fontWeight: FontWeight.bold),
                ),
                const Spacer(),
                Text(
                  'Est. $currencySymbol${totalPrice.toStringAsFixed(2)}',
                  style: AppType.bodySmall.copyWith(color: AppColors.subtle),
                ),
              ],
            ),
          ),
          Expanded(
            child: ListView.builder(
              itemCount: categories.length,
              itemBuilder: (_, ci) {
                final cat   = categories[ci];
                final items = grouped[cat]!;
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
                      child: Row(
                        children: [
                          _CategoryIcon(cat),
                          const SizedBox(width: 8),
                          Text(
                            cat[0].toUpperCase() + cat.substring(1),
                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                          ),
                        ],
                      ),
                    ),
                    ...items.map((item) => _GroceryItemTile(item: item, onToggle: _toggle)),
                  ],
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

/// Phase 5: minimal currency symbol lookup for the currently-registered
/// GroceryPriceProvider currencies. Falls back to the ISO code itself for
/// anything not yet mapped (e.g. a provider added server-side without a
/// matching client-side symbol).
String _currencySymbol(String? currencyCode) {
  const symbols = {'INR': '₹', 'USD': '\$', 'GBP': '£'};
  return symbols[currencyCode] ?? (currencyCode != null ? '$currencyCode ' : '₹');
}

class _CategoryIcon extends StatelessWidget {
  const _CategoryIcon(this.category);
  final String category;

  @override
  Widget build(BuildContext context) {
    const icons = {
      'produce':  Icons.local_florist,
      'dairy':    Icons.egg,
      'protein':  Icons.kebab_dining,
      'legumes':  Icons.grain,
      'grains':   Icons.bakery_dining,
      'oil':      Icons.water_drop,
      'nuts':     Icons.nature,
      'spices':   Icons.spa,
      'other':    Icons.category,
    };
    return Icon(icons[category] ?? Icons.category, size: 16, color: AppColors.subtle);
  }
}

class _GroceryItemTile extends StatelessWidget {
  const _GroceryItemTile({required this.item, required this.onToggle});
  final Map<String, dynamic> item;
  final Future<void> Function(String) onToggle;

  @override
  Widget build(BuildContext context) {
    final purchased = item['is_purchased'] as bool? ?? false;
    final name      = item['name'] as String;
    final qty       = (item['quantity'] as num?)?.toStringAsFixed(2) ?? '?';
    final unit      = item['unit'] as String? ?? '';
    final price     = (item['estimated_price'] as num?)?.toStringAsFixed(2);
    final symbol    = _currencySymbol(item['currency_code'] as String?);

    return ListTile(
      leading: Checkbox(
        value: purchased,
        onChanged: (_) => onToggle(item['id'] as String),
      ),
      title: Text(
        name,
        style: TextStyle(decoration: purchased ? TextDecoration.lineThrough : null),
      ),
      subtitle: Text('$qty $unit', style: AppType.bodySmall.copyWith(color: AppColors.subtle)),
      trailing: price != null
          ? Text('$symbol$price', style: AppType.bodySmall.copyWith(color: AppColors.subtle))
          : null,
    );
  }
}
