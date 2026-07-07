import 'dart:convert';
import 'package:drift/drift.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'local_db.dart';

part 'scan_queue.g.dart';

// Offline scan queue — stores scans locally first, syncs to API when online.
// Guarantees: a scan is NEVER lost due to network failure.

@riverpod
ScanQueue scanQueue(Ref ref) {
  final db = ref.watch(localDbProvider);
  return ScanQueue(db);
}

class ScanQueue {
  ScanQueue(this._db);
  final AppDatabase _db;

  // Enqueue a barcode scan immediately (offline-safe).
  Future<String> enqueueBarcodeScan({
    required String barcode,
    String? imageB64,
  }) async {
    final id = '${DateTime.now().microsecondsSinceEpoch}';
    await _db.into(_db.localScans).insert(
      LocalScansCompanion.insert(
        id: Value(id),
        barcode: Value(barcode),
        imageB64: Value(imageB64),
        status: const Value('pending'),
        createdAt: Value(DateTime.now().toIso8601String()),
      ),
    );
    return id;
  }

  // Enqueue an OCR scan (label photo).
  Future<String> enqueueOcrScan({
    required String ocrRawText,
    String? imageB64,
  }) async {
    final id = '${DateTime.now().microsecondsSinceEpoch}';
    await _db.into(_db.localScans).insert(
      LocalScansCompanion.insert(
        id: Value(id),
        ocrRawText: Value(ocrRawText),
        imageB64: Value(imageB64),
        status: const Value('pending'),
        createdAt: Value(DateTime.now().toIso8601String()),
      ),
    );
    return id;
  }

  Future<List<LocalScan>> getPendingScans() => _db.pendingScans();

  Future<void> markSynced(String id)               => _db.markScanSynced(id);
  Future<void> markFailed(String id, String error) => _db.markScanFailed(id, error);

  // Cache a resolved product locally for offline access.
  Future<void> cacheProduct({
    required String barcode,
    required String name,
    String? brand,
    required String source,
    double? energyKcal,
    double? proteinG,
    double? fatTotalG,
    double? carbohydratesG,
    double? sodiumMg,
    required Map<String, dynamic> fullJson,
  }) async {
    await _db.upsertProduct(
      LocalProductsCompanion(
        barcode: Value(barcode),
        name: Value(name),
        brand: Value(brand),
        source: Value(source),
        energyKcal: Value(energyKcal),
        proteinG: Value(proteinG),
        fatTotalG: Value(fatTotalG),
        carbohydratesG: Value(carbohydratesG),
        sodiumMg: Value(sodiumMg),
        jsonPayload: Value(jsonEncode(fullJson)),
        cachedAt: Value(DateTime.now().toIso8601String()),
      ),
    );
  }

  Future<Map<String, dynamic>?> getCachedProduct(String barcode) async {
    final row = await _db.getCachedProduct(barcode);
    if (row == null) return null;
    return jsonDecode(row.jsonPayload) as Map<String, dynamic>;
  }
}
