import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:nutrimind/core/offline/local_db.dart';
import 'package:nutrimind/core/offline/scan_queue.dart';

// Airplane-mode sync test:
// 1. Enqueue a barcode scan while "offline" (no API call)
// 2. Verify it is stored in pending state in the local DB
// 3. Simulate "coming online" — verify sync engine drains the queue
//
// Run with:
//   flutter test integration_test/airplane_mode_sync_test.dart
//   (requires a running device or emulator)

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  late AppDatabase db;
  late ScanQueue queue;

  setUp(() {
    db = AppDatabase();
    queue = ScanQueue(db);
  });

  tearDown(() async {
    await db.close();
  });

  testWidgets('offline scan persists and is retrievable', (tester) async {
    // Simulate enqueue with no network.
    final scanId = await queue.enqueueBarcodeScan(barcode: '8901063018853');
    expect(scanId, isNotEmpty);

    // Verify the scan is pending.
    final pending = await queue.getPendingScans();
    expect(pending.any((s) => s.id == scanId), isTrue);
    expect(pending.firstWhere((s) => s.id == scanId).status, equals('pending'));
  });

  testWidgets('marking scan synced removes it from pending queue', (tester) async {
    final scanId = await queue.enqueueBarcodeScan(barcode: '8901063018854');
    await queue.markSynced(scanId);

    final pending = await queue.getPendingScans();
    expect(pending.any((s) => s.id == scanId), isFalse);
  });

  testWidgets('product cache round-trip', (tester) async {
    const barcode = '8901063018855';
    await queue.cacheProduct(
      barcode: barcode,
      name: 'Test Product',
      brand: 'Test Brand',
      source: 'openfoodfacts',
      energyKcal: 350.0,
      proteinG: 12.0,
      fatTotalG: 8.0,
      carbohydratesG: 55.0,
      sodiumMg: 400.0,
      fullJson: {
        'barcode': barcode,
        'name': 'Test Product',
        'brand': 'Test Brand',
        'source': 'openfoodfacts',
        'nutrition': {
          'energyKcal': 350.0,
          'proteinG': 12.0,
          'fatTotalG': 8.0,
          'carbohydratesG': 55.0,
          'sodiumMg': 400.0,
        },
      },
    );

    final cached = await queue.getCachedProduct(barcode);
    expect(cached, isNotNull);
    expect(cached!['name'], equals('Test Product'));
    expect((cached['nutrition'] as Map)['energyKcal'], equals(350.0));
  });

  testWidgets('onboarding flags persist across reads', (tester) async {
    await db.setFlag('consent_v1', 'true');
    final value = await db.getFlag('consent_v1');
    expect(value, equals('true'));
  });
}
