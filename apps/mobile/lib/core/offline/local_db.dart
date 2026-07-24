import 'package:drift/drift.dart';
import 'package:drift_flutter/drift_flutter.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../features/auth/auth_state.dart';
import '../telemetry/telemetry.dart';

part 'local_db.g.dart';

final _log = getLogger('onboarding.state');

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

  // Premium redesign (Phase 2, ADR-0038) — Home's real-data stat cards read these. Both are
  // read-only queries over existing tables/columns; no schema change.
  Future<List<LocalProduct>> recentProducts({int limit = 5}) =>
      (select(localProducts)
            ..orderBy([(p) => OrderingTerm.desc(p.cachedAt)])
            ..limit(limit))
          .get();

  /// Real scans recorded today (device-local calendar day) — status-agnostic (pending, synced,
  /// and failed all still represent a real scan attempt the user made today).
  Future<int> scansTodayCount() async {
    final startOfDay = DateTime.now().toIso8601String().split('T').first;
    final rows = await (select(localScans)
          ..where((s) => s.createdAt.isBiggerOrEqualValue(startOfDay)))
        .get();
    return rows.length;
  }

  // ── Onboarding flags ──
  // Scoped by the signed-in Supabase user id: these flags live in a single on-device SQLite
  // file shared by every account that ever signs in on this device (family members, QA
  // testers, a reinstall-free logout/login cycle). Without the user id prefix, a second
  // account inherits the first account's "onboarding complete" flags and silently skips
  // onboarding — found by signing in as a freshly-registered user right after another
  // account had already completed it on the same emulator.
  String _scopedKey(String key) {
    final uid = Supabase.instance.client.auth.currentUser?.id;
    return uid == null ? key : '$uid:$key';
  }

  Future<String?> getFlag(String key) async {
    final row = await (select(onboardingFlags)..where((f) => f.key.equals(_scopedKey(key))))
        .getSingleOrNull();
    return row?.value;
  }

  Future<void> setFlag(String key, String value) =>
      into(onboardingFlags).insertOnConflictUpdate(
        OnboardingFlagsCompanion(key: Value(_scopedKey(key)), value: Value(value)),
      );

  // Device-global flags (NOT user-scoped) — for preferences that belong to the device/install
  // rather than an account, e.g. the light/dark theme choice, which must apply before any sign-in
  // and stay stable across account switches. Stored under a fixed `global:` namespace in the same
  // key/value table so it can never collide with a `_scopedKey` value ('<uuid>:key' or a bare key).
  Future<String?> getGlobalFlag(String key) async {
    final row = await (select(onboardingFlags)..where((f) => f.key.equals('global:$key')))
        .getSingleOrNull();
    return row?.value;
  }

  Future<void> setGlobalFlag(String key, String value) =>
      into(onboardingFlags).insertOnConflictUpdate(
        OnboardingFlagsCompanion(key: Value('global:$key'), value: Value(value)),
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
    required this.hasLanguage,
    required this.hasProfile,
  });
  final bool hasConsent;
  final bool hasDisclaimer;
  // Phase 10 (`global.p10.country_onboarding_v2`) — set once the user confirms/picks their
  // country in CountrySelectionScreen; gates entry to profile setup the same way
  // consent/disclaimer already do.
  final bool hasCountry;
  // Global onboarding rebuild — preferred language, gated the same way as country above.
  final bool hasLanguage;
  final bool hasProfile;
}

@riverpod
Future<OnboardingState> onboardingState(Ref ref) async {
  // Re-run whenever the signed-in user changes, since the flags below are scoped per user id
  // (see AppDatabase._scopedKey) — otherwise a sign-out/sign-in within the same app run would
  // keep serving the previous user's cached onboarding state.
  final authUserId = ref.watch(authStateProvider).valueOrNull?.user?.id;
  final db = ref.watch(localDbProvider);
  final consent    = await db.getFlag('consent_v1');
  final disclaimer = await db.getFlag('disclaimer_v1');
  final country     = await db.getFlag('country_v2');
  final language   = await db.getFlag('language_v1');
  final profile    = await db.getFlag('profile_complete');
  final result = OnboardingState(
    hasConsent:    consent == 'true',
    hasDisclaimer: disclaimer == 'true',
    hasCountry:    country == 'true',
    hasLanguage:   language == 'true',
    hasProfile:    profile == 'true',
  );
  _log.info(
    'onboardingState recomputed for user=$authUserId: consent=${result.hasConsent} '
    'disclaimer=${result.hasDisclaimer} country=${result.hasCountry} language=${result.hasLanguage} '
    'profile=${result.hasProfile}',
  );
  return result;
}

// Premium redesign (Phase 2, ADR-0038) — Home's real-data stat cards. Both read straight from
// the local Drift cache (no network call, no invented numbers) — genuinely empty when the user
// hasn't scanned anything yet, which Home renders as a designed empty state, not a zero-filled
// fake chart.
@riverpod
Future<List<LocalProduct>> recentScannedProducts(Ref ref) {
  final db = ref.watch(localDbProvider);
  return db.recentProducts();
}

@riverpod
Future<int> scansToday(Ref ref) {
  final db = ref.watch(localDbProvider);
  return db.scansTodayCount();
}

// Premium redesign (ADR-0034/ADR-0037) — Phase 1's cinematic pre-auth intro carousel. Distinct
// from OnboardingState above: this flag is intentionally NOT scoped to a signed-in user (it's
// checked before any sign-in exists) — AppDatabase._scopedKey already handles that correctly by
// falling back to the raw key when there's no current user, so this needs no schema change and
// no new scoping logic, just a new flag key on the existing generic key/value table.
@riverpod
Future<bool> appIntroSeen(Ref ref) async {
  final db = ref.watch(localDbProvider);
  final seen = await db.getFlag('app_intro_v1');
  return seen == 'true';
}
