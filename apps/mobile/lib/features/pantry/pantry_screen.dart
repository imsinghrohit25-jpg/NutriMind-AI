// Pantry Intelligence screen — list items, expiry alerts, scan receipt.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_mlkit_text_recognition/google_mlkit_text_recognition.dart';
import 'package:image_picker/image_picker.dart';
import '../../core/design_system/app_palette.dart';
import '../../core/design_system/tokens.dart';
import '../../core/network/api_client.dart';

class PantryScreen extends ConsumerStatefulWidget {
  const PantryScreen({super.key});

  @override
  ConsumerState<PantryScreen> createState() => _PantryScreenState();
}

class _PantryScreenState extends ConsumerState<PantryScreen> with SingleTickerProviderStateMixin {
  late final TabController _tabs;
  bool _loading = false;
  bool _scanning = false;
  List<Map<String, dynamic>> _items   = [];
  List<Map<String, dynamic>> _alerts  = [];
  String? _error;

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 2, vsync: this);
    _load();
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final api = ref.read(apiClientProvider);
      final [itemsResp, alertsResp] = await Future.wait([
        api.get<Map<String, dynamic>>('/api/v1/pantry/items'),
        api.get<Map<String, dynamic>>('/api/v1/pantry/expiry'),
      ]);
      if (mounted) {
        setState(() {
          _items  = (itemsResp.data?['items']   as List<dynamic>? ?? []).map((i) => i as Map<String, dynamic>).toList();
          _alerts = (alertsResp.data?['alerts']  as List<dynamic>? ?? []).map((i) => i as Map<String, dynamic>).toList();
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() { _error = e.toString(); _loading = false; });
    }
  }

  Future<void> _scanReceipt() async {
    setState(() { _scanning = true; _error = null; });
    try {
      final picker = ImagePicker();
      final file   = await picker.pickImage(source: ImageSource.camera, imageQuality: 85);
      if (file == null) { setState(() => _scanning = false); return; }

      final recognizer = TextRecognizer(script: TextRecognitionScript.latin);
      final result     = await recognizer.processImage(InputImage.fromFilePath(file.path));
      await recognizer.close();

      if (result.text.isEmpty) {
        setState(() { _scanning = false; _error = 'No text detected in receipt.'; });
        return;
      }

      final api  = ref.read(apiClientProvider);
      await api.post<Map<String, dynamic>>('/api/v1/pantry/receipts', data: {'text': result.text});
      if (mounted) {
        setState(() => _scanning = false);
        await _load();
      }
    } catch (e) {
      if (mounted) setState(() { _error = e.toString(); _scanning = false; });
    }
  }

  Future<void> _markConsumed(String itemId) async {
    try {
      final api = ref.read(apiClientProvider);
      await api.post<void>('/api/v1/pantry/items/$itemId', data: {'isConsumed': true});
      setState(() => _items.removeWhere((i) => i['id'] == itemId));
    } catch (_) {}
  }

  void _showAddDialog() {
    showDialog(context: context, builder: (_) => _AddItemDialog(onAdd: _addItem));
  }

  Future<void> _addItem(Map<String, dynamic> body) async {
    try {
      final api = ref.read(apiClientProvider);
      await api.post<Map<String, dynamic>>('/api/v1/pantry/items', data: body);
      await _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('Error: $e')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Pantry'),
        bottom: TabBar(
          controller: _tabs,
          tabs: [
            Tab(text: 'Items (${_items.length})'),
            Tab(text: _alerts.isNotEmpty ? 'Alerts (${_alerts.length})' : 'Alerts'),
          ],
        ),
        actions: [
          if (_scanning)
            const Padding(padding: EdgeInsets.all(12), child: SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)))
          else
            IconButton(
              icon: const Icon(Icons.receipt_long),
              tooltip: 'Scan Receipt',
              onPressed: _scanReceipt,
            ),
          IconButton(icon: const Icon(Icons.add), onPressed: _showAddDialog),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Text(_error!, style: const TextStyle(color: Colors.red)))
              : TabBarView(
              controller: _tabs,
              children: [
                _ItemsTab(items: _items, onConsumed: _markConsumed),
                _AlertsTab(alerts: _alerts),
              ],
            ),
    );
  }
}

class _ItemsTab extends StatelessWidget {
  const _ItemsTab({required this.items, required this.onConsumed});
  final List<Map<String, dynamic>> items;
  final void Function(String) onConsumed;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) {
      return Center(child: Text(
        'No pantry items yet.\nScan a receipt or add manually.',
        textAlign: TextAlign.center,
        style: AppType.bodySmall.copyWith(color: context.colors.subtle),
      ));
    }
    return ListView.separated(
      padding: const EdgeInsets.only(bottom: 24),
      itemCount: items.length,
      separatorBuilder: (_, __) => const Divider(height: 1, indent: 56),
      itemBuilder: (_, i) => _PantryItemTile(item: items[i], onConsumed: onConsumed),
    );
  }
}

class _PantryItemTile extends StatelessWidget {
  const _PantryItemTile({required this.item, required this.onConsumed});
  final Map<String, dynamic> item;
  final void Function(String) onConsumed;

  @override
  Widget build(BuildContext context) {
    final name     = item['name'] as String;
    final qty      = (item['quantity'] as num?)?.toStringAsFixed(1) ?? '1';
    final unit     = item['unit'] as String? ?? 'units';
    final expiry   = item['expiry_date'] as String?;
    final expired  = expiry != null && DateTime.parse(expiry).isBefore(DateTime.now());
    final warning  = expiry != null && !expired &&
        DateTime.parse(expiry).difference(DateTime.now()).inDays <= 3;

    return ListTile(
      leading: Icon(
        Icons.inventory_2_outlined,
        color: expired ? Colors.red : warning ? Colors.orange : context.colors.primary,
      ),
      title: Text(name),
      subtitle: Text(
        expiry != null
            ? '$qty $unit · Expires $expiry'
            : '$qty $unit',
        style: AppType.bodySmall.copyWith(
          color: expired ? Colors.red : warning ? Colors.orange : context.colors.subtle,
        ),
      ),
      trailing: IconButton(
        icon: const Icon(Icons.check, color: Colors.green),
        tooltip: 'Mark consumed',
        onPressed: () => onConsumed(item['id'] as String),
      ),
    );
  }
}

class _AlertsTab extends StatelessWidget {
  const _AlertsTab({required this.alerts});
  final List<Map<String, dynamic>> alerts;

  @override
  Widget build(BuildContext context) {
    if (alerts.isEmpty) {
      return Center(child: Text(
        'No expiry alerts within 7 days.',
        style: AppType.bodySmall.copyWith(color: context.colors.subtle),
      ));
    }
    return ListView.builder(
      itemCount: alerts.length,
      itemBuilder: (_, i) {
        final a        = alerts[i];
        final severity = a['severity'] as String;
        final days     = a['daysUntil'] as int;
        final color    = severity == 'expired' ? Colors.red
            : severity == 'critical' ? Colors.deepOrange
            : Colors.orange;

        return ListTile(
          leading: Icon(
            severity == 'expired' ? Icons.warning : Icons.schedule,
            color: color,
          ),
          title: Text(a['name'] as String),
          subtitle: Text(
            days < 0 ? 'Expired ${-days} day(s) ago'
                : days == 0 ? 'Expires today!'
                : 'Expires in $days day(s)',
            style: TextStyle(color: color),
          ),
          trailing: Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(severity, style: AppType.labelSmall.copyWith(color: color)),
          ),
        );
      },
    );
  }
}

class _AddItemDialog extends StatefulWidget {
  const _AddItemDialog({required this.onAdd});
  final Future<void> Function(Map<String, dynamic>) onAdd;

  @override
  State<_AddItemDialog> createState() => _AddItemDialogState();
}

class _AddItemDialogState extends State<_AddItemDialog> {
  final _nameCtrl   = TextEditingController();
  final _qtyCtrl    = TextEditingController(text: '1');
  String _unit      = 'units';
  String? _expiryDate;

  @override
  void dispose() {
    _nameCtrl.dispose();
    _qtyCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: DateTime.now().add(const Duration(days: 7)),
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 3650)),
    );
    if (picked != null) {
      setState(() => _expiryDate = picked.toIso8601String().substring(0, 10));
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Add Pantry Item'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          TextField(
            controller: _nameCtrl,
            decoration: const InputDecoration(labelText: 'Item name'),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _qtyCtrl,
                  decoration: const InputDecoration(labelText: 'Quantity'),
                  keyboardType: TextInputType.number,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: DropdownButtonFormField<String>(
                  initialValue: _unit,
                  decoration: const InputDecoration(labelText: 'Unit'),
                  items: ['units','kg','g','l','ml','packet'].map((u) =>
                    DropdownMenuItem(value: u, child: Text(u))).toList(),
                  onChanged: (v) => setState(() => _unit = v ?? 'units'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          GestureDetector(
            onTap: _pickDate,
            child: InputDecorator(
              decoration: const InputDecoration(labelText: 'Expiry date (optional)'),
              child: Text(_expiryDate ?? 'Tap to select', style: AppType.bodyMedium),
            ),
          ),
        ],
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
        FilledButton(
          onPressed: () {
            Navigator.pop(context);
            widget.onAdd({
              'name':       _nameCtrl.text.trim(),
              'quantity':   double.tryParse(_qtyCtrl.text) ?? 1.0,
              'unit':       _unit,
              if (_expiryDate != null) 'expiryDate': _expiryDate,
            });
          },
          child: const Text('Add'),
        ),
      ],
    );
  }
}
