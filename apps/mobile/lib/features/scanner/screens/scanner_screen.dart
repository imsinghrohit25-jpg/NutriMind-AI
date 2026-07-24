import '../../../core/design_system/components/app_loader.dart';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart'; // Uint8List / WriteBuffer for camera image byte packing
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:camera/camera.dart';
import 'package:google_mlkit_barcode_scanning/google_mlkit_barcode_scanning.dart'
    show InputImageMetadata, InputImageRotationValue, InputImageFormatValue;
import 'package:permission_handler/permission_handler.dart';

import '../../../core/design_system/components/scan_frame.dart';
import '../../../core/design_system/haptic_service.dart';
import '../../../core/design_system/app_palette.dart';
import '../../../core/design_system/tokens.dart';
import '../../../core/telemetry/telemetry.dart';
import '../barcode_mlkit.dart';
import '../flows/barcode_flow.dart';
import '../flows/label_flow.dart';
import '../flows/meal_photo_flow.dart';
import '../pipeline.dart';

final _log = getLogger('scanner.screen');

// What the scanner screen captures — one screen, three capture modes, selected by the caller
// (Home's "Scan barcode" / "Scan nutrition label" / "Snap a meal" cards). Previously these were
// two separate Home cards routed to the exact same barcode-only screen — "Scan nutrition label"
// silently did nothing useful, since there was no way to reach the OCR pipeline (which already
// existed and worked) from the UI at all. `meal` (production audit 2026-07) photographs a plate
// of food for multi-dish AI identification — same single-still capture unit as label mode.
enum ScanMode { barcode, label, meal }

class ScannerScreen extends ConsumerStatefulWidget {
  const ScannerScreen({super.key, this.mode = ScanMode.barcode});
  final ScanMode mode;

  @override
  ConsumerState<ScannerScreen> createState() => _ScannerScreenState();
}

enum _PermissionState { checking, granted, denied, permanentlyDenied }

class _ScannerScreenState extends ConsumerState<ScannerScreen>
    with WidgetsBindingObserver {
  CameraController? _camera;
  bool _initialising = true;
  bool _scanning = false;
  bool _streamStarted = false;
  bool _processingFrame = false;
  DateTime? _lastDetectionAt;
  // Guards against re-resolving the same barcode over and over while the user holds the product
  // steady in frame: after a result screen returns, live detection restarts immediately, and the
  // still-visible barcode gets detected and resolved again within one throttle tick. On a real
  // device this hammered the backend hard enough to trip its rate limit within a few seconds
  // (confirmed via the API access log during on-device testing).
  String? _lastResolvedBarcode;
  DateTime? _lastResolvedAt;
  static const _resolveCooldown = Duration(seconds: 10); // design-governance:ignore: scan cooldown, not an animation
  String? _error;
  _PermissionState _permission = _PermissionState.checking;
  // Cinematic "lock-on" moment (Phase 3) — brackets snap + glow the instant a barcode resolves,
  // for the beat between HapticFeedback and the push to the result screen. Presentation only;
  // does not gate or delay the real detection/navigation logic below.
  bool _locked = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _checkPermissionAndInit();
  }

  Future<void> _checkPermissionAndInit() async {
    final status = await Permission.camera.status;
    _log.info('Camera permission status: $status');
    if (status.isGranted) {
      setState(() => _permission = _PermissionState.granted);
      await _initCamera();
      return;
    }
    final result = await Permission.camera.request();
    _log.info('Camera permission request result: $result');
    if (!mounted) return;
    if (result.isGranted) {
      setState(() => _permission = _PermissionState.granted);
      await _initCamera();
    } else if (result.isPermanentlyDenied) {
      setState(() { _permission = _PermissionState.permanentlyDenied; _initialising = false; });
    } else {
      setState(() { _permission = _PermissionState.denied; _initialising = false; });
    }
  }

  Future<void> _initCamera() async {
    try {
      final cameras = await availableCameras();
      if (cameras.isEmpty) {
        setState(() { _error = 'No camera available on this device'; _initialising = false; });
        return;
      }
      final camera = cameras.firstWhere(
        (c) => c.lensDirection == CameraLensDirection.back,
        orElse: () => cameras.first,
      );
      _camera = CameraController(
        camera,
        ResolutionPreset.high,
        enableAudio: false,
        // Formats ML Kit's InputImage.fromBytes conversion expects natively on each platform —
        // avoids a manual YUV420-to-NV21 re-encode step.
        imageFormatGroup: Platform.isIOS ? ImageFormatGroup.bgra8888 : ImageFormatGroup.nv21,
      );
      await _camera!.initialize();
      if (!mounted) return;
      setState(() => _initialising = false);
      if (widget.mode == ScanMode.barcode) {
        await _startLiveDetection(camera);
      }
    } catch (e) {
      _log.warning('Camera initialization failed', e);
      if (mounted) setState(() { _error = 'Camera error: $e'; _initialising = false; });
    }
  }

  // Continuous live detection while the preview is running — the primary barcode path. The
  // manual capture button remains as a fallback for a barcode that the stream is slow to pick up
  // (motion blur, awkward angle) and is the only path for label mode (a single still photo is the
  // right unit of work for OCR, not a per-frame stream).
  Future<void> _startLiveDetection(CameraDescription camera) async {
    if (_camera == null || _streamStarted) return;
    try {
      await _camera!.startImageStream((image) => _onFrame(image, camera));
      _streamStarted = true;
      _log.info('Live barcode detection stream started');
    } catch (e) {
      // Falls back to manual-capture-only — some devices/emulator camera backends don't support
      // startImageStream reliably; the shutter button still works either way.
      _log.warning('startImageStream failed, falling back to manual capture only', e);
    }
  }

  Future<void> _stopLiveDetection() async {
    if (!_streamStarted || _camera == null) return;
    try {
      await _camera!.stopImageStream();
    } catch (_) {
      // Already stopped/disposed — nothing to do.
    }
    _streamStarted = false;
  }

  Future<void> _onFrame(CameraImage image, CameraDescription camera) async {
    if (_processingFrame || _scanning) return;
    // Throttle: ML Kit decode is not free — cap at roughly 3 attempts/sec so we don't queue up
    // frames faster than they can be processed.
    final now = DateTime.now();
    if (_lastDetectionAt != null && now.difference(_lastDetectionAt!) < const Duration(milliseconds: 300)) { // design-governance:ignore: detection throttle, not an animation
      return;
    }
    _lastDetectionAt = now;
    _processingFrame = true;
    try {
      final pipeline = ref.read(scanPipelineProvider);
      final frame = _frameFromCameraImage(image, camera);
      if (frame == null) return;
      final barcodes = await pipeline.scanLiveFrame(frame.bytes, frame.metadata);
      ScannedBarcode? best;
      for (final b in barcodes) {
        if (b.isProductBarcode) { best = b; break; }
      }
      if (best != null &&
          best.value == _lastResolvedBarcode &&
          _lastResolvedAt != null &&
          now.difference(_lastResolvedAt!) < _resolveCooldown) {
        return;
      }
      if (best != null && mounted && !_scanning) {
        await _handleDetected(best);
      }
    } catch (e) {
      _log.warning('Live frame decode failed', e);
    } finally {
      _processingFrame = false;
    }
  }

  // Standard camera-plugin → ML Kit conversion: concatenate all image planes into one buffer
  // (matches how google_mlkit_barcode_scanning's InputImage.fromBytes expects NV21/BGRA8888
  // single-buffer input) and derive rotation from the camera's fixed sensor orientation — this
  // app only ever uses the back camera in portrait, so no device-orientation compensation is
  // needed beyond that fixed value.
  //
  // Each plane's `bytesPerRow` is the HAL's row stride, which on many devices (this was found on
  // a real Samsung device, not the emulator) is wider than the tightly-packed row width — the ISP
  // pads each row to an alignment boundary. Naively concatenating `plane.bytes` as-is carries that
  // padding into the buffer, desyncing it from the `width`/`height` passed in InputImageMetadata
  // and making the native ML Kit NV21 decoder crash with a bare NullPointerException
  // (InputImageConverterError) on every single frame. Stripping the padding row-by-row here
  // produces the tightly-packed buffer ML Kit actually expects, regardless of the device's stride.
  ({Uint8List bytes, InputImageMetadata metadata})? _frameFromCameraImage(
    CameraImage image,
    CameraDescription camera,
  ) {
    final rotation = InputImageRotationValue.fromRawValue(camera.sensorOrientation);
    if (rotation == null) return null;

    final format = InputImageFormatValue.fromRawValue(image.format.raw);
    if (format == null) return null;

    final allBytes = WriteBuffer();
    for (final plane in image.planes) {
      final bytesPerPixel = plane.bytesPerPixel ?? 1;
      final planeWidth = plane.width ?? image.width;
      final planeHeight = plane.height ?? image.height;
      final rowBytes = planeWidth * bytesPerPixel;
      if (plane.bytesPerRow == rowBytes) {
        // No padding — safe to take the plane as-is.
        allBytes.putUint8List(plane.bytes);
        continue;
      }
      for (var row = 0; row < planeHeight; row++) {
        final start = row * plane.bytesPerRow;
        allBytes.putUint8List(plane.bytes.sublist(start, start + rowBytes));
      }
    }
    final bytes = allBytes.done().buffer.asUint8List();

    return (
      bytes: bytes,
      metadata: InputImageMetadata(
        size: Size(image.width.toDouble(), image.height.toDouble()),
        rotation: rotation,
        format: format,
        // Tight row stride now that padding has been stripped above.
        bytesPerRow: image.width * (image.planes.first.bytesPerPixel ?? 1),
      ),
    );
  }

  Future<void> _handleDetected(ScannedBarcode barcode) async {
    setState(() { _scanning = true; _locked = true; });
    await _stopLiveDetection();
    HapticService.medium();
    _lastResolvedBarcode = barcode.value;
    _lastResolvedAt = DateTime.now();
    try {
      final pipeline = ref.read(scanPipelineProvider);
      final result = await pipeline.processDetectedBarcode(barcode);
      if (!mounted) return;
      await Navigator.of(context).push(
        MaterialPageRoute<void>(builder: (_) => BarcodeFlowResult(result: result)),
      );
    } finally {
      if (mounted) {
        setState(() { _scanning = false; _locked = false; });
        if (widget.mode == ScanMode.barcode && _camera != null && _camera!.value.isInitialized) {
          await _startLiveDetection(_camera!.description);
        }
      }
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (_camera == null || !_camera!.value.isInitialized) return;
    if (state == AppLifecycleState.inactive) {
      _stopLiveDetection();
      _camera?.dispose();
    } else if (state == AppLifecycleState.resumed) {
      _initCamera();
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _stopLiveDetection();
    _camera?.dispose();
    super.dispose();
  }

  Future<void> _captureAndScan() async {
    if (_scanning || _camera == null || !_camera!.value.isInitialized) return;
    setState(() => _scanning = true);
    await _stopLiveDetection();
    try {
      final file = await _camera!.takePicture();
      final pipeline = ref.read(scanPipelineProvider);

      if (widget.mode == ScanMode.label) {
        final result = await pipeline.processLabelImage(file.path);
        if (!mounted) return;
        if (result.ocrResult != null) {
          await Navigator.of(context).push(
            MaterialPageRoute<void>(builder: (_) => LabelFlowResult(ocrResult: result.ocrResult!)),
          );
        }
        return;
      }

      if (widget.mode == ScanMode.meal) {
        Map<String, dynamic>? apiResponse;
        String? errorMessage;
        try {
          apiResponse = await pipeline.processMealPhoto(file.path);
        } catch (e) {
          _log.warning('Meal photo scan failed', e);
          errorMessage = 'Could not analyse the photo. Check your connection and try again.';
        }
        if (!mounted) return;
        if (apiResponse != null) {
          await Navigator.of(context).push(
            MaterialPageRoute<void>(builder: (_) => MealPhotoFlowResult(apiResponse: apiResponse!)),
          );
        } else {
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text(errorMessage ?? 'You\'re offline — meal photo analysis needs a connection.'),
          ));
        }
        return;
      }

      final result = await pipeline.processBarcodeImage(file.path);
      if (!mounted) return;
      await Navigator.of(context).push(
        MaterialPageRoute<void>(builder: (_) => BarcodeFlowResult(result: result)),
      );
    } finally {
      if (mounted) {
        setState(() => _scanning = false);
        if (widget.mode == ScanMode.barcode && _camera != null && _camera!.value.isInitialized) {
          await _startLiveDetection(_camera!.description);
        }
      }
    }
  }

  Future<void> _openSettings() async {
    await openAppSettings();
  }

  @override
  Widget build(BuildContext context) {
    final title = switch (widget.mode) {
      ScanMode.label => 'Scan Nutrition Label',
      ScanMode.meal => 'Snap a Meal',
      ScanMode.barcode => 'Scan Product',
    };

    if (_permission == _PermissionState.denied || _permission == _PermissionState.permanentlyDenied) {
      return Scaffold(
        appBar: AppBar(title: Text(title)),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.xl),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.camera_alt_outlined, size: 48, color: context.colors.subtle),
                const SizedBox(height: AppSpacing.l),
                Text(
                  _permission == _PermissionState.permanentlyDenied
                      ? 'Camera access was denied. Enable it in Settings to scan products.'
                      : 'NutriMind needs camera access to scan barcodes and nutrition labels.',
                  style: AppType.bodyMedium,
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: AppSpacing.l),
                FilledButton(
                  onPressed: _permission == _PermissionState.permanentlyDenied
                      ? _openSettings
                      : _checkPermissionAndInit,
                  child: Text(_permission == _PermissionState.permanentlyDenied ? 'Open Settings' : 'Grant permission'),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: Stack(
        children: [
          if (_initialising)
            const Center(child: AppLoader())
          else if (_error != null)
            Center(child: Padding(
              padding: const EdgeInsets.all(AppSpacing.xl),
              child: Text(_error!, style: AppType.bodyMedium, textAlign: TextAlign.center),
            ))
          else
            SizedBox.expand(child: CameraPreview(_camera!)),

          // Cinematic scan guide overlay — animated corner brackets + sweeping laser (barcode
          // mode only; label/meal are single-still captures, no continuous live sweep), with a
          // brief lock-on glow the instant `_handleDetected` fires (see `_locked` above).
          if (!_initialising && _error == null)
            Center(
              child: ScanFrameOverlay(
                locked: _locked,
                showLaser: widget.mode == ScanMode.barcode,
              ),
            ),

          if (!_initialising && _error == null)
            Positioned(
              top: 24,
              left: 0, right: 0,
              child: Center(
                child: Text(
                  switch (widget.mode) {
                    ScanMode.label => 'Line up the nutrition facts panel, then tap to capture',
                    ScanMode.meal => 'Frame the whole plate, then tap to identify the dishes',
                    ScanMode.barcode => 'Hold steady over the barcode — auto-detects, or tap to capture',
                  },
                  style: AppType.bodySmall.copyWith(color: Colors.white),
                  textAlign: TextAlign.center,
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
                      color: _scanning ? context.colors.subtle : context.colors.primary,
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
