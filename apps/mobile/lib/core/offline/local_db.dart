import 'package:drift/drift.dart';
import 'package:drift_flutter/drift_flutter.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'local_db.g.dart';

// ─── Tables ──────────────────────────────────────────────────────────────────

class LocalScans extends Table {
  TextColumn get id         => text().clientDefault(_uuid)();
  TextColumn get barcode    => text().nullable()();
  TextColumn get imageB64   => text().nullable()();  // compressed JPEG base64
  TextColumn get ocrRawText => text().nullable()();
  TextColumn get status     => text().withDefault(const Constant('pending'))();
  // pending | synced | failed
  TextColumn get errorMsg   => text().nullable()();
  TextColumn get createdAt  => text().clientDefault(_now)();
  TextColumn get syncedAt   => text().nullable()();

  @override
  Set<Column> get primaryKey => {id};
}

class LocalProducts extends Table {
  TextColumn get barcode      => text()();
  TextColumn get name         => text()();
  TextColumn get brand        => text().nullable()();
  TextColumn get source       => text()();
  RealColumn get energyKcal   => real().nullable()();
  RealColumn get proteinG     => real().nullable()();
  RealColumn get fatTotalG    => real().nullable()();
  RealColumn get carbohydratesG => real().nullable()();
  RealColumn get sodiumMg     => real().nullable()();
  TextColumn get jsonPayload  => text()();     // full canonical product JSON
  TextColumn get cachedAt     => text().clientDefault(_now)();

  @override
  Set<Column> get primaryKey => {barcode};
}

class OnboardingFlags extends Table {
  TextColumn get key   => text()();
  TextColumn get value => text()();

  @override
  Set<Column> get primaryKey => {key};
}

String _uuid() => DateTime.now().microsecondsSinceEpoch.toString();
String _now()  => DateTime.now().toIso8601String();

// ─── Database ─────────────────────────────────────────────────────────────────

@DriftDatabase(tables: [LocalScans, LocalProducts, OnboardingFlags])
class AppDatabase extends _$AppDatabase {
  AppDatabase() : super(_openConnection());

  @override
  int get schemaVersion => 1;

  // ── Scans ──
  Future<List<LocalScan>> pendingScans() =>
      (select(localScans)..where((s) => s.status.equals('pending'))).get();

  Future<void> markScanSynced(String id) =>
      (update(localScans)..where((s) => s.id.equals(id))).write(
        LocalScansCompanion(
          status: const Value('synced'),
          syncedAt: Value(DateTime.now().toIso8601String()),
        ),
      );

  Future<void> markScanFailed(String id, String error) =>
      (update(localScans)..where((s) => s.id.equals(id))).write(
        LocalScansCompanion(
          status: const Value('failed'),
          errorMsg: Value(error),
        ),
      );

  // ── Products ──
  Future<LocalProduct?> getCachedProduct(String barcode) =>
      (select(localProducts)..where((p) => p.barcode.equals(barcode)))
          .getSingleOrNull();

  Future<void> upsertProduct(LocalProductsCompanion product) =>
      into(localProducts).insertOnConflictUpdate(product);

  // ── Onboarding flags ──
  Future<String?> getFlag(String key) async {
    final row = await (select(onboardingFlags)..where((f) => f.key.equals(key)))
        .getSingleOrNull();
    return row?.value;
  }

  Future<void> setFlag(String key, String value) =>
      into(onboardingFlags).insertOnConflictUpdate(
        OnboardingFlagsCompanion(key: Value(key), value: Value(value)),
      );
}

LazyDatabase _openConnection() {
  return LazyDatabase(() async {
    return driftDatabase(name: 'nutrimind_local');
  });
}

// ─── Riverpod ─────────────────────────────────────────────────────────────────

@Riverpod(keepAlive: true)
AppDatabase localDb(Ref ref) {
  final db = AppDatabase();
  ref.onDispose(db.close);
  return db;
}

// Onboarding state read from local DB flags.
class OnboardingState {
  const OnboardingState({
    required this.hasConsent,
    required this.hasDisclaimer,
    required this.hasCountry,
    required this.hasProfile,
  });
  final bool hasConsent;
  final bool hasDisclaimer;
  // Phase 10 (`global.p10.country_onboarding_v2`) — set once the user confirms/picks their
  // country in CountrySelectionScreen; gates entry to profile setup the same way
  // consent/disclaimer already do.
  final bool hasCountry;
  final bool hasProfile;
}

@riverpod
Future<OnboardingState> onboardingState(Ref ref) async {
  final db = ref.watch(localDbProvider);
  final consent    = await db.getFlag('consent_v1');
  final disclaimer = await db.getFlag('disclaimer_v1');
  final country     = await db.getFlag('country_v2');
  final profile    = await db.getFlag('profile_complete');
  return OnboardingState(
    hasConsent:    consent == 'true',
    hasDisclaimer: disclaimer == 'true',
    hasCountry:    country == 'true',
    hasProfile:    profile == 'true',
  );
}
