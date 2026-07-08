// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Indonesian (`id`).
class AppLocalizationsId extends AppLocalizations {
  AppLocalizationsId([String locale = 'id']) : super(locale);

  @override
  String get appName => 'NutriMind AI';

  @override
  String get scanProduct => 'Pindai produk';

  @override
  String get healthScore => 'Skor Kesehatan';

  @override
  String get excellent => 'Sangat Baik';

  @override
  String get good => 'Baik';

  @override
  String get fair => 'Cukup';

  @override
  String get poor => 'Buruk';

  @override
  String novaGroup(int group) {
    return 'Kelompok NOVA $group';
  }

  @override
  String get ingredients => 'Bahan-bahan';

  @override
  String get allergenWarning => 'Peringatan Alergen';

  @override
  String allergenDeclared(String allergen) {
    return 'Mengandung $allergen';
  }

  @override
  String allergenTrace(String allergen) {
    return 'Mungkin mengandung jejak $allergen';
  }

  @override
  String get allergenFailSafe =>
      'Kami tidak dapat membaca daftar bahan dengan andal. Periksa alergen secara manual.';

  @override
  String get nutritionFacts => 'Informasi Gizi';

  @override
  String get per100g => 'per 100g';

  @override
  String perServing(num g) {
    final intl.NumberFormat gNumberFormat =
        intl.NumberFormat.decimalPattern(localeName);
    final String gString = gNumberFormat.format(g);

    return 'per sajian (${gString}g)';
  }

  @override
  String get energyKcal => 'Energi';

  @override
  String get protein => 'Protein';

  @override
  String get totalFat => 'Total Lemak';

  @override
  String get saturatedFat => 'Lemak Jenuh';

  @override
  String get transFat => 'Lemak Trans';

  @override
  String get carbohydrates => 'Karbohidrat';

  @override
  String get totalSugars => 'Total Gula';

  @override
  String get addedSugars => 'Gula Tambahan';

  @override
  String get dietaryFibre => 'Serat Pangan';

  @override
  String get sodium => 'Natrium';

  @override
  String get copilotTitle => 'Kopilot Gizi';

  @override
  String get copilotDisclaimer => 'Bukan pengganti saran medis atau diet.';

  @override
  String get copilotPlaceholder => 'Tanyakan tentang produk ini…';

  @override
  String get weeklyReport => 'Laporan Mingguan';

  @override
  String get mealLog => 'Catatan Makan';

  @override
  String get groceryCart => 'Keranjang Belanja';

  @override
  String get alternatives => 'Alternatif Lebih Sehat';

  @override
  String get budgetPickBadge => 'Pilihan hemat';

  @override
  String get thinCategoryMessage =>
      'Tidak ditemukan alternatif dengan skor lebih baik di kategori ini.';

  @override
  String get notificationSettings => 'Pengaturan Notifikasi';

  @override
  String get weeklyReportNotif => 'Laporan gizi mingguan';

  @override
  String get allergenAlertNotif => 'Peringatan alergen';

  @override
  String get allergenAlertLockedNote =>
      'Peringatan keamanan kritis — tidak dapat dinonaktifkan';

  @override
  String get dataRightsTitle => 'Data Anda';

  @override
  String get exportData => 'Ekspor data saya';

  @override
  String get deleteAccount => 'Hapus akun saya';

  @override
  String get deleteConfirmTitle => 'Hapus akun?';

  @override
  String get deleteConfirmBody =>
      'Ini akan menghapus secara permanen semua pindaian, catatan makan, dan data profil Anda. Tindakan ini tidak dapat dibatalkan.';

  @override
  String get deleteConfirmButton => 'Hapus permanen';

  @override
  String get childModeWarning => 'Mode Keamanan Anak Aktif';

  @override
  String get hypertensionWarning =>
      'Natrium tinggi — perhatian untuk hipertensi';

  @override
  String get diabetesWarning => 'Gula tinggi — perhatian untuk diabetes';

  @override
  String get searchHistoryTitle => 'Riwayat Pencarian';

  @override
  String get searchHistoryHint =>
      'mis. camilan natrium tinggi, biskuit skor rendah';

  @override
  String get estimatedValue => 'Perkiraan';

  @override
  String get disclaimer =>
      'Hanya untuk tujuan informasi. Bukan pengganti saran gizi profesional.';
}
