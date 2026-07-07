import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../network/api_client.dart';
import 'connectivity.dart';
import 'scan_queue.dart';

part 'sync_engine.g.dart';

// Sync engine — drains the offline scan queue whenever the device comes online.
// Called from app.dart on connectivity change and at app launch.

@riverpod
SyncEngine syncEngine(Ref ref) {
  final queue  = ref.watch(scanQueueProvider);
  final client = ref.watch(apiClientProvider);
  return SyncEngine(queue, client);
}

enum SyncStatus { idle, syncing, done, error }

class SyncEngine {
  SyncEngine(this._queue, this._client);

  final ScanQueue  _queue;
  final ApiClient  _client;

  SyncStatus _status = SyncStatus.idle;
  SyncStatus get status => _status;

  // Syncs all pending scans. Safe to call repeatedly; no-op if already syncing.
  Future<SyncResult> syncPending() async {
    if (_status == SyncStatus.syncing) {
      return const SyncResult(synced: 0, failed: 0);
    }
    _status = SyncStatus.syncing;

    int synced = 0, failed = 0;

    try {
      final pending = await _queue.getPendingScans();

      for (final scan in pending) {
        try {
          if (scan.barcode != null) {
            await _client.post<dynamic>(
              '/v1/resolve/barcode',
              data: {'barcode': scan.barcode},
            );
          } else if (scan.ocrRawText != null) {
            await _client.post<dynamic>(
              '/v1/scans/ocr',
              data: {'rawText': scan.ocrRawText},
            );
          }
          await _queue.markSynced(scan.id);
          synced++;
        } catch (e) {
          await _queue.markFailed(scan.id, e.toString());
          failed++;
        }
      }

      _status = SyncStatus.done;
    } catch (_) {
      _status = SyncStatus.error;
    }

    return SyncResult(synced: synced, failed: failed);
  }
}

class SyncResult {
  const SyncResult({required this.synced, required this.failed});
  final int synced;
  final int failed;
  bool get hasErrors => failed > 0;
}

// Watches connectivity and triggers sync automatically when online.
@riverpod
void autoSync(Ref ref) {
  final isOnline = ref.watch(isOnlineProvider);
  isOnline.whenData((online) {
    if (online) {
      ref.read(syncEngineProvider).syncPending();
    }
  });
}
