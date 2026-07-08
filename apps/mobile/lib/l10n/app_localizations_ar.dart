// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Arabic (`ar`).
class AppLocalizationsAr extends AppLocalizations {
  AppLocalizationsAr([String locale = 'ar']) : super(locale);

  @override
  String get appName => 'NutriMind AI';

  @override
  String get scanProduct => 'مسح منتج';

  @override
  String get healthScore => 'نقاط الصحة';

  @override
  String get excellent => 'ممتاز';

  @override
  String get good => 'جيد';

  @override
  String get fair => 'مقبول';

  @override
  String get poor => 'ضعيف';

  @override
  String novaGroup(int group) {
    return 'مجموعة NOVA $group';
  }

  @override
  String get ingredients => 'المكونات';

  @override
  String get allergenWarning => 'تحذير من مسببات الحساسية';

  @override
  String allergenDeclared(String allergen) {
    return 'يحتوي على $allergen';
  }

  @override
  String allergenTrace(String allergen) {
    return 'قد يحتوي على آثار من $allergen';
  }

  @override
  String get allergenFailSafe =>
      'لم نتمكن من قراءة قائمة المكونات بشكل موثوق. تحقق من مسببات الحساسية يدوياً.';

  @override
  String get nutritionFacts => 'القيم الغذائية';

  @override
  String get per100g => 'لكل 100غ';

  @override
  String perServing(num g) {
    final intl.NumberFormat gNumberFormat =
        intl.NumberFormat.decimalPattern(localeName);
    final String gString = gNumberFormat.format(g);

    return 'لكل حصة ($gStringغ)';
  }

  @override
  String get energyKcal => 'الطاقة';

  @override
  String get protein => 'البروتين';

  @override
  String get totalFat => 'الدهون الكلية';

  @override
  String get saturatedFat => 'الدهون المشبعة';

  @override
  String get transFat => 'الدهون المتحولة';

  @override
  String get carbohydrates => 'الكربوهيدرات';

  @override
  String get totalSugars => 'إجمالي السكريات';

  @override
  String get addedSugars => 'السكريات المضافة';

  @override
  String get dietaryFibre => 'الألياف الغذائية';

  @override
  String get sodium => 'الصوديوم';

  @override
  String get copilotTitle => 'مساعد التغذية';

  @override
  String get copilotDisclaimer => 'ليس بديلاً عن المشورة الطبية أو الغذائية.';

  @override
  String get copilotPlaceholder => 'اسأل عن هذا المنتج…';

  @override
  String get weeklyReport => 'التقرير الأسبوعي';

  @override
  String get mealLog => 'سجل الوجبات';

  @override
  String get groceryCart => 'عربة التسوق';

  @override
  String get alternatives => 'بدائل أكثر صحة';

  @override
  String get budgetPickBadge => 'خيار اقتصادي';

  @override
  String get thinCategoryMessage =>
      'لم يتم العثور على بدائل بتقييم أفضل في هذه الفئة.';

  @override
  String get notificationSettings => 'إعدادات الإشعارات';

  @override
  String get weeklyReportNotif => 'التقرير الغذائي الأسبوعي';

  @override
  String get allergenAlertNotif => 'تنبيهات مسببات الحساسية';

  @override
  String get allergenAlertLockedNote =>
      'تنبيهات الأمان الحيوية — لا يمكن تعطيلها';

  @override
  String get dataRightsTitle => 'بياناتك';

  @override
  String get exportData => 'تصدير بياناتي';

  @override
  String get deleteAccount => 'حذف حسابي';

  @override
  String get deleteConfirmTitle => 'حذف الحساب؟';

  @override
  String get deleteConfirmBody =>
      'سيؤدي هذا إلى حذف جميع عمليات المسح وسجلات الوجبات وبيانات الملف الشخصي نهائياً. لا يمكن التراجع عن هذا.';

  @override
  String get deleteConfirmButton => 'حذف نهائياً';

  @override
  String get childModeWarning => 'وضع سلامة الأطفال مفعّل';

  @override
  String get hypertensionWarning =>
      'صوديوم مرتفع — احتياط لمرضى ارتفاع ضغط الدم';

  @override
  String get diabetesWarning => 'سكر مرتفع — احتياط لمرضى السكري';

  @override
  String get searchHistoryTitle => 'سجل البحث';

  @override
  String get searchHistoryHint =>
      'مثال: وجبات خفيفة عالية الصوديوم، بسكويت بتقييم منخفض';

  @override
  String get estimatedValue => 'مُقدَّر';

  @override
  String get disclaimer =>
      'لأغراض المعلومات فقط. ليس بديلاً عن المشورة الغذائية المهنية.';
}
