import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:camera/camera.dart';

import '../../../core/design_system/tokens.dart';
import '../pipeline.dart';

class ScannerScreen extends ConsumerStatefulWidget {
  const ScannerScreen({super.key});

  @override
  ConsumerState<ScannerScreen> createState() => _ScannerScreenState();
}

class _ScannerScreenState extends ConsumerState<ScannerScreen>
    with WidgetsBindingObserver {
  CameraController? _camera;
  bool _initialising = true;
  bool _scanning = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _initCamera();
  }

  Future<void> _initCamera() async {
    try {
      final cameras = await availableCameras();
      if (cameras.isEmpty) {
        setState(() { _error = 'No camera available'; _initialising = false; });
        return;
      }
      // Prefer back camera.
      final camera = cameras.firstWhere(
        (c) => c.lensDirection == CameraLensDirection.back,
        orElse: () => cameras.first,
      );
      _camera = CameraController(camera, ResolutionPreset.high, enableAudio: false);
      await _camera!.initialize();
      if (mounted) setState(() => _initialising = false);
    } catch (e) {
      if (mounted) setState(() { _error = 'Camera error: $e'; _initialising = false; });
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (_camera == null || !_camera!.value.isInitialized) return;
    if (state == AppLifecycleState.inactive) {
      _camera?.dispose();
    } else if (state == AppLifecycleState.resumed) {
      _initCamera();
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _camera?.dispose();
    super.dispose();
  }

  Future<void> _captureAndScan() async {
    if (_scanning || _camera == null || !_camera!.value.isInitialized) return;
    setState(() => _scanning = true);
    try {
      final file = await _camera!.takePicture();
      final pipeline = ref.read(scanPipelineProvider);
      final result = await pipeline.processBarcodeImage(file.path);

      if (!mounted) return;

      if (!result.success) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(result.error ?? 'No barcode found')),
        );
        return;
      }

      if (result.product != null) {
        _showProductSheet(result.product!);
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              result.barcode != null
                  ? 'Barcode: ${result.barcode} — saved offline, will sync when online'
                  : 'Scan queued for sync',
            ),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _scanning = false);
    }
  }

  void _showProductSheet(Map<String, dynamic> product) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppSpacing.xl)),
      ),
      builder: (_) => _ProductResultSheet(product: product),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Scan Product')),
      body: Stack(
        children: [
          if (_initialising)
            const Center(child: CircularProgressIndicator())
          else if (_error != null)
            Center(child: Text(_error!, style: AppType.bodyMedium))
          else
            SizedBox.expand(child: CameraPreview(_camera!)),

          // Scan guide overlay
          if (!_initialising && _error == null)
            Center(
              child: Container(
                width: 260,
                height: 160,
                decoration: BoxDecoration(
                  border: Border.all(color: AppColors.primary, width: 2),
                  borderRadius: BorderRadius.circular(AppSpacing.m),
                ),
              ),
            ),

          // Capture button
          if (!_initialising && _error == null)
            Positioned(
              bottom: 48,
              left: 0, right: 0,
              child: Center(
                child: GestureDetector(
                  onTap: _captureAndScan,
                  child: Container(
                    width: 72, height: 72,
                    decoration: BoxDecoration(
                      color: _scanning ? AppColors.subtle : AppColors.primary,
                      shape: BoxShape.circle,
                    ),
                    child: _scanning
                        ? const Padding(
                            padding: EdgeInsets.all(AppSpacing.l),
                            child: CircularProgressIndicator(strokeWidth: 3, color: Colors.white),
                          )
                        : const Icon(Icons.camera_alt, color: Colors.white, size: 32),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _ProductResultSheet extends StatelessWidget {
  const _ProductResultSheet({required this.product});
  final Map<String, dynamic> product;

  @override
  Widget build(BuildContext context) {
    final name     = product['name'] as String? ?? 'Unknown product';
    final brand    = product['brand'] as String?;
    final nutrition = product['nutrition'] as Map<String, dynamic>?;
    final kcal     = nutrition?['energyKcal'];
    final protein  = nutrition?['proteinG'];
    final fat      = nutrition?['fatTotalG'];
    final carbs    = nutrition?['carbohydratesG'];

    return Padding(
      padding: const EdgeInsets.all(AppSpacing.xl),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Expanded(child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name, style: AppType.headlineMedium),
                if (brand != null) Text(brand, style: AppType.bodyMedium.copyWith(color: AppColors.subtle)),
              ],
            )),
            IconButton(
              icon: const Icon(Icons.close),
              onPressed: () => Navigator.of(context).pop(),
            ),
          ]),
          const SizedBox(height: AppSpacing.xl),
          if (nutrition != null) ...[
            Text('Per 100g', style: AppType.titleSmall.copyWith(color: AppColors.subtle)),
            const SizedBox(height: AppSpacing.m),
            _NutrientRow('Energy', kcal != null ? '${kcal.toStringAsFixed(0)} kcal' : '—'),
            _NutrientRow('Protein', protein != null ? '${(protein as num).toStringAsFixed(1)} g' : '—'),
            _NutrientRow('Fat', fat != null ? '${(fat as num).toStringAsFixed(1)} g' : '—'),
            _NutrientRow('Carbohydrates', carbs != null ? '${(carbs as num).toStringAsFixed(1)} g' : '—'),
          ] else
            const Text('Nutrition data not available.'),
          const SizedBox(height: AppSpacing.xl),
        ],
      ),
    );
  }
}

class _NutrientRow extends StatelessWidget {
  const _NutrientRow(this.label, this.value);
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
      child: Row(children: [
        Expanded(child: Text(label, style: AppType.bodyMedium)),
        Text(value, style: AppType.bodyMedium.copyWith(fontWeight: FontWeight.w600)),
      ]),
    );
  }
}
