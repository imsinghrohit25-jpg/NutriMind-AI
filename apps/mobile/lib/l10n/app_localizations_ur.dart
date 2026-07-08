// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Urdu (`ur`).
class AppLocalizationsUr extends AppLocalizations {
  AppLocalizationsUr([String locale = 'ur']) : super(locale);

  @override
  String get appName => 'NutriMind AI';

  @override
  String get scanProduct => 'پروڈکٹ اسکین کریں';

  @override
  String get healthScore => 'صحت کا اسکور';

  @override
  String get excellent => 'بہترین';

  @override
  String get good => 'اچھا';

  @override
  String get fair => 'ٹھیک';

  @override
  String get poor => 'ناقص';

  @override
  String novaGroup(int group) {
    return 'NOVA گروپ $group';
  }

  @override
  String get ingredients => 'اجزاء';

  @override
  String get allergenWarning => 'الرجی کی تنبیہ';

  @override
  String allergenDeclared(String allergen) {
    return '$allergen موجود ہے';
  }

  @override
  String allergenTrace(String allergen) {
    return '$allergen کے آثار ہو سکتے ہیں';
  }

  @override
  String get allergenFailSafe =>
      'اجزاء کی فہرست قابل اعتماد طریقے سے نہیں پڑھی جا سکی۔ الرجینز کو دستی طور پر جانچیں۔';

  @override
  String get nutritionFacts => 'غذائی حقائق';

  @override
  String get per100g => 'فی 100گ';

  @override
  String perServing(num g) {
    final intl.NumberFormat gNumberFormat =
        intl.NumberFormat.decimalPattern(localeName);
    final String gString = gNumberFormat.format(g);

    return 'فی خوراک ($gStringگ)';
  }

  @override
  String get energyKcal => 'توانائی';

  @override
  String get protein => 'پروٹین';

  @override
  String get totalFat => 'کل چکنائی';

  @override
  String get saturatedFat => 'سیچوریٹڈ چکنائی';

  @override
  String get transFat => 'ٹرانس چکنائی';

  @override
  String get carbohydrates => 'کاربوہائیڈریٹس';

  @override
  String get totalSugars => 'کل شکر';

  @override
  String get addedSugars => 'اضافی شکر';

  @override
  String get dietaryFibre => 'غذائی ریشہ';

  @override
  String get sodium => 'سوڈیم';

  @override
  String get copilotTitle => 'غذائیت کو-پائلٹ';

  @override
  String get copilotDisclaimer => 'طبی یا غذائی مشورے کا متبادل نہیں۔';

  @override
  String get copilotPlaceholder => 'اس پروڈکٹ کے بارے میں پوچھیں…';

  @override
  String get weeklyReport => 'ہفتہ وار رپورٹ';

  @override
  String get mealLog => 'کھانے کا لاگ';

  @override
  String get groceryCart => 'گروسری کارٹ';

  @override
  String get alternatives => 'صحت مند متبادلات';

  @override
  String get budgetPickBadge => 'بجٹ انتخاب';

  @override
  String get thinCategoryMessage =>
      'اس زمرے میں بہتر اسکور والے کوئی متبادل نہیں ملے۔';

  @override
  String get notificationSettings => 'اطلاع کی ترتیبات';

  @override
  String get weeklyReportNotif => 'ہفتہ وار غذائیت رپورٹ';

  @override
  String get allergenAlertNotif => 'الرجی کی تنبیہات';

  @override
  String get allergenAlertLockedNote =>
      'اہم حفاظتی تنبیہات — غیر فعال نہیں کی جا سکتیں';

  @override
  String get dataRightsTitle => 'آپ کا ڈیٹا';

  @override
  String get exportData => 'میرا ڈیٹا برآمد کریں';

  @override
  String get deleteAccount => 'میرا اکاؤنٹ حذف کریں';

  @override
  String get deleteConfirmTitle => 'اکاؤنٹ حذف کریں؟';

  @override
  String get deleteConfirmBody =>
      'اس سے آپ کے تمام اسکینز، کھانے کے لاگز اور پروفائل ڈیٹا مستقل طور پر مٹ جائیں گے۔ یہ واپس نہیں لیا جا سکتا۔';

  @override
  String get deleteConfirmButton => 'مستقل طور پر حذف کریں';

  @override
  String get childModeWarning => 'بچوں کی حفاظتی موڈ فعال';

  @override
  String get hypertensionWarning =>
      'زیادہ سوڈیم — ہائی بلڈ پریشر کے لیے احتیاط';

  @override
  String get diabetesWarning => 'زیادہ شکر — ذیابیطس کے لیے احتیاط';

  @override
  String get searchHistoryTitle => 'تلاش کی تاریخ';

  @override
  String get searchHistoryHint => 'مثلاً زیادہ سوڈیم اسنیکس، کم اسکور بسکٹ';

  @override
  String get estimatedValue => 'تخمینہ';

  @override
  String get disclaimer =>
      'صرف معلوماتی مقاصد کے لیے۔ پیشہ ور غذائی مشورے کا متبادل نہیں۔';
}
