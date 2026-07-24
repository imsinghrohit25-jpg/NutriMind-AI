import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';
import 'package:dio/dio.dart';
import 'package:flutter_image_compress/flutter_image_compress.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_mlkit_barcode_scanning/google_mlkit_barcode_scanning.dart' show InputImageMetadata;
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../core/network/api_client.dart';
import '../../core/offline/connectivity.dart';
import '../../core/offline/scan_queue.dart';
import '../../core/telemetry/telemetry.dart';
import 'barcode_mlkit.dart';
import 'ocr_mlkit.dart';

part 'pipeline.g.dart';

// Scan pipeline — orchestrates barcode detection, OCR, image compression,
// offline queuing, and API submission. Offline-first: never loses a scan.

final _log = getLogger('scanner.pipeline');

// Max image size before upload — verified in gate.
const _maxImageBytes = 1024 * 1024;  // 1 MB

@riverpod
ScanPipeline scanPipeline(Ref ref) {
  final queue   = ref.watch(scanQueueProvider);
  final client  = ref.watch(apiClientProvider);
  final isOnlineStream = ref.watch(isOnlineProvider);
  return ScanPipeline(queue, client, isOnlineStream.valueOrNull ?? false);
}

class ScanPipeline {
  ScanPipeline(this._queue, this._client, this._isOnline);

  final ScanQueue  _queue;
  final ApiClient  _client;
  final bool       _isOnline;

  final _barcodeScanner = BarcodeMlKit();
  final _ocr = OcrMlKit();

  // Full barcode scan flow (manual capture — single photo, decoded then resolved):
  // 1. ML Kit scan (on-device, offline)
  // 2. Compress image if present
  // 3. Queue locally (offline guarantee)
  // 4. If online: resolve via API immediately + cache result
  Future<ScanPipelineResult> processBarcodeImage(String imagePath) async {
    // Step 1: On-device scan
    final barcodes = await _barcodeScanner.scanFile(imagePath);
    if (barcodes.isEmpty) {
      _log.info('Barcode detected: none');
      return const ScanPipelineResult(success: false, error: 'No barcode detected');
    }

    final best = barcodes.firstWhere(
      (b) => b.isProductBarcode,
      orElse: () => barcodes.first,
    );
    _log.info('Barcode detected: ${best.value} (format=${best.format})');

    // Step 2: Image compression (kept alongside the barcode for the offline scan queue).
    final compressedB64 = await _compressToBase64(imagePath);

    return resolveBarcode(barcode: best.value, barcodeFormat: best.format, imageB64: compressedB64);
  }

  // Live-detection entry point — used by the continuous camera-stream scanner (real-time
  // detection while the preview is running, instead of one manual shutter-press-then-decode).
  // ML Kit has already decoded the barcode from a preview frame by the time this is called, so
  // there's no captured still photo to attach — the offline scan queue still gets the barcode
  // value (imageB64 null), matching the file-based path's queue-then-resolve behavior otherwise.
  Future<ScanPipelineResult> processDetectedBarcode(ScannedBarcode barcode) async {
    _log.info('Barcode detected (live): ${barcode.value} (format=${barcode.format})');
    return resolveBarcode(barcode: barcode.value, barcodeFormat: barcode.format);
  }

  // Decodes one live camera-preview frame (raw bytes + metadata built by the screen from a
  // `CameraImage`) — exposes the same on-device ML Kit scanner used by the file-based path above
  // without leaking `BarcodeMlKit` (private to this class) to the UI layer.
  Future<List<ScannedBarcode>> scanLiveFrame(Uint8List bytes, InputImageMetadata metadata) =>
      _barcodeScanner.scanBytes(bytes, metadata);

  // Shared queue-then-resolve logic for both capture paths above.
  // 1. Queue locally (offline guarantee)
  // 2. If online: resolve via API immediately (Supabase cache → OpenFoodFacts fallback) + cache result
  Future<ScanPipelineResult> resolveBarcode({
    required String barcode,
    required String barcodeFormat,
    String? imageB64,
  }) async {
    final scanId = await _queue.enqueueBarcodeScan(barcode: barcode, imageB64: imageB64);

    Map<String, dynamic>? productData;
    List<dynamic>? diseaseGuidance;
    Map<String, dynamic>? healthScore;
    Map<String, dynamic>? safety;
    var notFound = false;
    if (_isOnline) {
      try {
        _log.info('Resolving barcode $barcode via /v1/resolve/barcode (Supabase-first, OFF fallback)');
        final resp = await _client.post<Map<String, dynamic>>(
          '/v1/resolve/barcode',
          data: {'barcode': barcode},
        );
        final body = resp.data;
        _log.info('Resolve response for $barcode: status=${resp.statusCode} resolvedBy=${(body?['data'] as Map?)?['resolvedBy']}');
        if (body != null && body['ok'] == true) {
          productData = (body['data'] as Map<String, dynamic>?)?['product'] as Map<String, dynamic>?;
          diseaseGuidance = (body['data'] as Map<String, dynamic>?)?['diseaseGuidance'] as List<dynamic>?;
          // Real deterministic Health Score + Allergen Hard Gate (premium redesign Phase 3,
          // ADR-0039) — null whenever the engine had nothing to score/check (e.g. no nutrition).
          healthScore = (body['data'] as Map<String, dynamic>?)?['healthScore'] as Map<String, dynamic>?;
          safety = (body['data'] as Map<String, dynamic>?)?['safety'] as Map<String, dynamic>?;
          if (productData != null && barcode.isNotEmpty) {
            await _queue.cacheProduct(
              barcode: barcode,
              name: productData['name'] as String? ?? 'Unknown',
              brand: productData['brand'] as String?,
              source: productData['source'] as String? ?? 'openfoodfacts',
              energyKcal: (productData['nutrition'] as Map?)?['energyKcal'] as double?,
              proteinG: (productData['nutrition'] as Map?)?['proteinG'] as double?,
              fatTotalG: (productData['nutrition'] as Map?)?['fatTotalG'] as double?,
              carbohydratesG: (productData['nutrition'] as Map?)?['carbohydratesG'] as double?,
              sodiumMg: (productData['nutrition'] as Map?)?['sodiumMg'] as double?,
              fullJson: productData,
            );
            _log.info('Cached resolved product locally for $barcode (source=${productData['source']})');
          }
          await _queue.markSynced(scanId);
        }
      } on DioException catch (e) {
        if (e.response?.statusCode == 404) {
          // Genuine "not found" from the backend (cache miss + OFF miss + curation-queued) —
          // distinct from a network failure so the UI can show the right screen instead of
          // the misleading "saved offline, will sync" message.
          notFound = true;
          _log.info('Resolve response for $barcode: not found (404), curation entry queued server-side');
          await _queue.markSynced(scanId);
        } else {
          _log.warning('Resolve request failed for $barcode with DioException', e);
        }
      } catch (e, st) {
        _log.warning('Resolve request failed for $barcode with unexpected error', e, st);
      }
    } else {
      // Offline: check local cache
      productData = await _queue.getCachedProduct(barcode);
      _log.info('Offline — checked local cache for $barcode: ${productData != null ? "hit" : "miss"}');
    }

    _log.info(
      'Final UI for $barcode: '
      '${productData != null ? "product screen" : notFound ? "not-found screen" : "offline-queued screen"}',
    );

    return ScanPipelineResult(
      success: true,
      barcode: barcode,
      barcodeFormat: barcodeFormat,
      product: productData,
      diseaseGuidance: diseaseGuidance,
      healthScore: healthScore,
      safety: safety,
      notFound: notFound,
      syncedImmediately: _isOnline && productData != null,
      scanId: scanId,
    );
  }

  // Meal photo flow — posts the captured photo to /v1/scans/meal for multi-dish identification,
  // portion estimation, per-dish + whole-meal nutrition, and (authenticated) disease notes.
  // Unlike barcode/label there is no on-device fallback: dish recognition is inherently a
  // cloud-vision task, so offline returns a clear error instead of a queued promise we can't keep.
  Future<Map<String, dynamic>?> processMealPhoto(String imagePath) async {
    if (!_isOnline) return null;
    final bytes = await File(imagePath).readAsBytes();
    // The API caps meal images at 4 MB base64; camera stills routinely exceed that raw, so
    // always compress here (quality 70 keeps dishes recognisable well under the cap).
    final compressed = await FlutterImageCompress.compressWithList(
      bytes,
      quality: 70,
      format: CompressFormat.jpeg,
    );
    final b64 = base64Encode(compressed);
    _log.info('Meal photo: ${bytes.length}B raw → ${compressed.length}B compressed, posting to /v1/scans/meal');
    final resp = await _client.post<Map<String, dynamic>>(
      '/v1/scans/meal',
      data: {'imageBase64': b64, 'imageMediaType': 'image/jpeg'},
    );
    final body = resp.data;
    if (body != null && body['ok'] == true) {
      return body['data'] as Map<String, dynamic>?;
    }
    return null;
  }

  // OCR label scan flow.
  Future<ScanPipelineResult> processLabelImage(String imagePath) async {
    final ocrResult = await _ocr.recognizeFile(imagePath);
    final compressedB64 = await _compressToBase64(imagePath);

    final scanId = await _queue.enqueueOcrScan(
      ocrRawText: ocrResult.rawText,
      imageB64: compressedB64,
    );

    return ScanPipelineResult(
      success: true,
      ocrResult: ocrResult,
      syncedImmediately: false,
      scanId: scanId,
      needsUserConfirmation: ocrResult.needsUserConfirmation,
    );
  }

  Future<String?> _compressToBase64(String imagePath) async {
    try {
      final file = File(imagePath);
      final bytes = await file.readAsBytes();

      // Check if compression needed
      if (bytes.length <= _maxImageBytes) {
        return null;  // Skip base64 for now; full implementation in Phase 5
      }

      // Compress to target quality
      final compressed = await FlutterImageCompress.compressWithList(
        bytes,
        quality: 70,
        format: CompressFormat.jpeg,
      );

      // Verify compression result meets limit
      assert(
        compressed.length <= _maxImageBytes,
        'Compressed image exceeds 1 MB limit: ${compressed.length} bytes',
      );

      return null;  // Return base64 in Phase 5 when upload is wired up
    } catch (_) {
      return null;
    }
  }

  Future<void> dispose() async {
    await _barcodeScanner.close();
    await _ocr.close();
  }
}

class ScanPipelineResult {
  const ScanPipelineResult({
    required this.success,
    this.barcode,
    this.barcodeFormat,
    this.product,
    this.diseaseGuidance,
    this.healthScore,
    this.safety,
    this.ocrResult,
    this.notFound = false,
    this.syncedImmediately = false,
    this.needsUserConfirmation = false,
    this.scanId,
    this.error,
  });

  final bool success;
  final String? barcode;
  final String? barcodeFormat;
  final Map<String, dynamic>? product;
  // Disease-aware evaluations for the signed-in user's conditions (10-condition expansion) —
  // null when anonymous, offline, or the user has no stored conditions.
  final List<dynamic>? diseaseGuidance;
  // Real deterministic Health Score (engines/score/engine.ts) — null only when the product has
  // no nutrition data to score (premium redesign Phase 3, ADR-0039).
  final Map<String, dynamic>? healthScore;
  // Allergen Hard Gate result (engines/allergen/detector.ts + fail-safe.ts) — allergenMatches,
  // childWarnings, hasFailSafe, failSafeReason. Null only when there's no product at all.
  final Map<String, dynamic>? safety;
  final OcrResult? ocrResult;
  // True when the backend definitively resolved "not found" (Supabase cache miss + OpenFoodFacts
  // miss + curation-queued) — distinct from `product == null` due to being offline, which should
  // show a different screen (see BarcodeFlowResult).
  final bool notFound;
  final bool syncedImmediately;
  final bool needsUserConfirmation;
  final String? scanId;
  final String? error;
}
