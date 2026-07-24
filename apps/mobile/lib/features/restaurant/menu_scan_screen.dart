// Restaurant menu scanner — takes photo of menu, OCRs it, sends to API for scoring.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_mlkit_text_recognition/google_mlkit_text_recognition.dart';
import 'package:image_picker/image_picker.dart';
import '../../core/design_system/app_palette.dart';
import '../../core/design_system/tokens.dart';
import '../../core/network/api_client.dart';

class MenuScanScreen extends ConsumerStatefulWidget {
  const MenuScanScreen({super.key});

  @override
  ConsumerState<MenuScanScreen> createState() => _MenuScanScreenState();
}

class _MenuScanScreenState extends ConsumerState<MenuScanScreen> {
  bool   _scanning  = false;
  bool   _loading   = false;
  List<_ScoredItem> _items = [];
  String? _restaurantName;
  String? _error;

  Future<void> _scan(ImageSource source) async {
    setState(() { _scanning = true; _error = null; });
    try {
      final picker = ImagePicker();
      final file   = await picker.pickImage(source: source, imageQuality: 90);
      if (file == null) { setState(() => _scanning = false); return; }

      final recognizer = TextRecognizer(script: TextRecognitionScript.latin);
      final result     = await recognizer.processImage(InputImage.fromFilePath(file.path));
      await recognizer.close();

      if (result.text.trim().isEmpty) {
        setState(() { _scanning = false; _error = 'No text found in image.'; });
        return;
      }

      setState(() { _scanning = false; _loading = true; });
      await _upload(result.text);
    } catch (e) {
      if (mounted) setState(() { _scanning = false; _error = e.toString(); });
    }
  }

  Future<void> _upload(String text) async {
    try {
      final api  = ref.read(apiClientProvider);
      final resp = await api.post<Map<String, dynamic>>(
        '/api/v1/restaurant/menu/scan',
        data: {'text': text},
      );
      final data  = resp.data ?? {};
      final items = (data['items'] as List<dynamic>? ?? []).map((i) {
        final m = i as Map<String, dynamic>;
        final score = m['score'] as Map<String, dynamic>? ?? {};
        return _ScoredItem(
          name:     m['name'] as String,
          category: m['category'] as String?,
          isVeg:    m['isVeg'] as bool? ?? true,
          priceRs:  (m['priceRs'] as num?)?.toDouble(),
          suitable: score['suitable'] as bool? ?? true,
          scoreLabel: score['score'] as String? ?? 'neutral',
          warnings: (score['warnings'] as List<dynamic>?)
              ?.map((w) => w as String)
              .toList() ?? [],
        );
      }).toList();

      if (mounted) {
        setState(() {
          _items          = items;
          _restaurantName = data['restaurantName'] as String?;
          _loading        = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() { _error = e.toString(); _loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_restaurantName != null ? _restaurantName! : 'Menu Scanner'),
      ),
      body: Column(
        children: [
          // Scan buttons
          Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              children: [
                Expanded(
                  child: FilledButton.icon(
                    onPressed: (_scanning || _loading) ? null : () => _scan(ImageSource.camera),
                    icon: const Icon(Icons.camera_alt),
                    label: const Text('Scan Menu'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: (_scanning || _loading) ? null : () => _scan(ImageSource.gallery),
                    icon: const Icon(Icons.photo_library),
                    label: const Text('Gallery'),
                  ),
                ),
              ],
            ),
          ),
          if (_scanning || _loading) ...[
            const LinearProgressIndicator(),
            Padding(
              padding: const EdgeInsets.all(8),
              child: Text(_scanning ? 'Reading menu...' : 'Analysing...'),
            ),
          ],
          if (_error != null)
            Padding(
              padding: const EdgeInsets.all(16),
              child: Text(_error!, style: const TextStyle(color: Colors.red)),
            ),
          if (_items.isNotEmpty)
            Expanded(
              child: ListView.separated(
                padding: const EdgeInsets.only(bottom: 24),
                itemCount: _items.length,
                separatorBuilder: (_, __) => const Divider(height: 1, indent: 56),
                itemBuilder: (_, i) => _MenuItemTile(item: _items[i]),
              ),
            ),
          if (_items.isEmpty && !_scanning && !_loading && _error == null)
            Expanded(
              child: Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.restaurant_menu, size: 64, color: Colors.grey),
                    const SizedBox(height: 16),
                    Text(
                      'Scan a restaurant menu to see\nhealth scores for each item.',
                      style: AppType.bodySmall.copyWith(color: context.colors.subtle),
                      textAlign: TextAlign.center,
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _ScoredItem {
  const _ScoredItem({
    required this.name, required this.isVeg, required this.suitable,
    required this.scoreLabel, required this.warnings,
    this.category, this.priceRs,
  });
  final String  name;
  final bool    isVeg;
  final bool    suitable;
  final String  scoreLabel;
  final List<String> warnings;
  final String? category;
  final double? priceRs;
}

class _MenuItemTile extends StatelessWidget {
  const _MenuItemTile({required this.item});
  final _ScoredItem item;

  Color get _scoreColor {
    switch (item.scoreLabel) {
      case 'good':    return Colors.green;
      case 'avoid':   return Colors.red;
      default:        return Colors.orange;
    }
  }

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: Container(
        width: 32, height: 32,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: _scoreColor.withValues(alpha: 0.15),
          border: Border.all(color: _scoreColor, width: 1.5),
        ),
        child: Icon(
          item.scoreLabel == 'good'  ? Icons.check
              : item.scoreLabel == 'avoid' ? Icons.close
              : Icons.remove,
          color: _scoreColor,
          size: 16,
        ),
      ),
      title: Row(
        children: [
          Text(item.name, style: const TextStyle(fontWeight: FontWeight.w500)),
          const SizedBox(width: 6),
          Container(
            width: 10, height: 10,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: item.isVeg ? Colors.green : Colors.red,
              border: Border.all(color: Colors.white, width: 1),
            ),
          ),
        ],
      ),
      subtitle: item.warnings.isNotEmpty
          ? Text(
              item.warnings.join(' • '),
              style: AppType.bodySmall.copyWith(color: Colors.red),
            )
          : item.category != null
              ? Text(item.category!, style: AppType.bodySmall.copyWith(color: context.colors.subtle))
              : null,
      trailing: item.priceRs != null
          ? Text('₹${item.priceRs!.toStringAsFixed(0)}')
          : null,
    );
  }
}
