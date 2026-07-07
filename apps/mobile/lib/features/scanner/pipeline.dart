import 'dart:io';
import 'package:flutter_image_compress/flutter_image_compress.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../core/network/api_client.dart';
import '../../core/offline/connectivity.dart';
import '../../core/offline/scan_queue.dart';
import 'barcode_mlkit.dart';
import 'ocr_mlkit.dart';

part 'pipeline.g.dart';

// Scan pipeline — orchestrates barcode detection, OCR, image compression,
// offline queuing, and API submission. Offline-first: never loses a scan.

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

  // Full barcode scan flow:
  // 1. ML Kit scan (on-device, offline)
  // 2. Compress image if present
  // 3. Queue locally (offline guarantee)
  // 4. If online: resolve via API immediately + cache result
  Future<ScanPipelineResult> processBarcodeImage(String imagePath) async {
    // Step 1: On-device scan
    final barcodes = await _barcodeScanner.scanFile(imagePath);
    if (barcodes.isEmpty) {
      return const ScanPipelineResult(success: false, error: 'No barcode detected');
    }

    final best = barcodes.firstWhere(
      (b) => b.isProductBarcode,
      orElse: () => barcodes.first,
    );

    // Step 2: Image compression
    final compressedB64 = await _compressToBase64(imagePath);

    // Step 3: Queue locally (always — offline guarantee)
    final scanId = await _queue.enqueueBarcodeScan(
      barcode: best.value,
      imageB64: compressedB64,
    );

    // Step 4: Resolve immediately if online
    Map<String, dynamic>? productData;
    if (_isOnline) {
      try {
        final resp = await _client.post<Map<String, dynamic>>(
          '/v1/resolve/barcode',
          data: {'barcode': best.value},
        );
        final body = resp.data;
        if (body != null && body['ok'] == true) {
          productData = (body['data'] as Map<String, dynamic>?)?['product'] as Map<String, dynamic>?;
          if (productData != null && best.value.isNotEmpty) {
            await _queue.cacheProduct(
              barcode: best.value,
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
          }
          await _queue.markSynced(scanId);
        }
      } catch (_) {
        // Sync failed — scan remains pending; sync engine will retry
      }
    } else {
      // Offline: check local cache
      productData = await _queue.getCachedProduct(best.value);
    }

    return ScanPipelineResult(
      success: true,
      barcode: best.value,
      barcodeFormat: best.format,
      product: productData,
      syncedImmediately: _isOnline && productData != null,
      scanId: scanId,
    );
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
    this.ocrResult,
    this.syncedImmediately = false,
    this.needsUserConfirmation = false,
    this.scanId,
    this.error,
  });

  final bool success;
  final String? barcode;
  final String? barcodeFormat;
  final Map<String, dynamic>? product;
  final OcrResult? ocrResult;
  final bool syncedImmediately;
  final bool needsUserConfirmation;
  final String? scanId;
  final String? error;
}
