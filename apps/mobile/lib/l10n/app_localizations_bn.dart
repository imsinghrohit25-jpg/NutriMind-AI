// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Bengali Bangla (`bn`).
class AppLocalizationsBn extends AppLocalizations {
  AppLocalizationsBn([String locale = 'bn']) : super(locale);

  @override
  String get appName => 'NutriMind AI';

  @override
  String get scanProduct => 'পণ্য স্ক্যান করুন';

  @override
  String get healthScore => 'স্বাস্থ্য স্কোর';

  @override
  String get excellent => 'চমৎকার';

  @override
  String get good => 'ভালো';

  @override
  String get fair => 'মাঝারি';

  @override
  String get poor => 'খারাপ';

  @override
  String novaGroup(int group) {
    return 'NOVA গ্রুপ $group';
  }

  @override
  String get ingredients => 'উপাদান';

  @override
  String get allergenWarning => 'অ্যালার্জেন সতর্কতা';

  @override
  String allergenDeclared(String allergen) {
    return '$allergen রয়েছে';
  }

  @override
  String allergenTrace(String allergen) {
    return '$allergen-এর চিহ্ন থাকতে পারে';
  }

  @override
  String get allergenFailSafe =>
      'উপাদান তালিকা নির্ভরযোগ্যভাবে পড়া যায়নি। অ্যালার্জেন ম্যানুয়ালি পরীক্ষা করুন।';

  @override
  String get nutritionFacts => 'পুষ্টির তথ্য';

  @override
  String get per100g => 'প্রতি ১০০গ্রাম';

  @override
  String perServing(num g) {
    final intl.NumberFormat gNumberFormat =
        intl.NumberFormat.decimalPattern(localeName);
    final String gString = gNumberFormat.format(g);

    return 'প্রতি পরিবেশনে ($gStringগ্রাম)';
  }

  @override
  String get energyKcal => 'শক্তি';

  @override
  String get protein => 'প্রোটিন';

  @override
  String get totalFat => 'মোট চর্বি';

  @override
  String get saturatedFat => 'স্যাচুরেটেড ফ্যাট';

  @override
  String get transFat => 'ট্রান্স ফ্যাট';

  @override
  String get carbohydrates => 'কার্বোহাইড্রেট';

  @override
  String get totalSugars => 'মোট চিনি';

  @override
  String get addedSugars => 'যোগ করা চিনি';

  @override
  String get dietaryFibre => 'খাদ্যতালিকাগত আঁশ';

  @override
  String get sodium => 'সোডিয়াম';

  @override
  String get copilotTitle => 'পুষ্টি কোপাইলট';

  @override
  String get copilotDisclaimer => 'চিকিৎসা বা ডায়েটেটিক পরামর্শের বিকল্প নয়।';

  @override
  String get copilotPlaceholder => 'এই পণ্য সম্পর্কে জিজ্ঞাসা করুন…';

  @override
  String get weeklyReport => 'সাপ্তাহিক রিপোর্ট';

  @override
  String get mealLog => 'খাবার লগ';

  @override
  String get groceryCart => 'মুদিখানার ঝুড়ি';

  @override
  String get alternatives => 'স্বাস্থ্যকর বিকল্প';

  @override
  String get budgetPickBadge => 'বাজেট পছন্দ';

  @override
  String get thinCategoryMessage =>
      'এই বিভাগে আরও ভালো স্কোরের কোনো বিকল্প পাওয়া যায়নি।';

  @override
  String get notificationSettings => 'বিজ্ঞপ্তি সেটিংস';

  @override
  String get weeklyReportNotif => 'সাপ্তাহিক পুষ্টি রিপোর্ট';

  @override
  String get allergenAlertNotif => 'অ্যালার্জেন সতর্কতা';

  @override
  String get allergenAlertLockedNote =>
      'সমালোচনামূলক নিরাপত্তা সতর্কতা — নিষ্ক্রিয় করা যাবে না';

  @override
  String get dataRightsTitle => 'আপনার ডেটা';

  @override
  String get exportData => 'আমার ডেটা রপ্তানি করুন';

  @override
  String get deleteAccount => 'আমার অ্যাকাউন্ট মুছুন';

  @override
  String get deleteConfirmTitle => 'অ্যাকাউন্ট মুছবেন?';

  @override
  String get deleteConfirmBody =>
      'এটি আপনার সমস্ত স্ক্যান, খাবার লগ এবং প্রোফাইল ডেটা স্থায়ীভাবে মুছে দেবে। এটি পূর্বাবস্থায় ফেরানো যাবে না।';

  @override
  String get deleteConfirmButton => 'স্থায়ীভাবে মুছুন';

  @override
  String get childModeWarning => 'শিশু নিরাপত্তা মোড সক্রিয়';

  @override
  String get hypertensionWarning => 'উচ্চ সোডিয়াম — উচ্চ রক্তচাপে সতর্কতা';

  @override
  String get diabetesWarning => 'উচ্চ চিনি — ডায়াবেটিসে সতর্কতা';

  @override
  String get searchHistoryTitle => 'অনুসন্ধানের ইতিহাস';

  @override
  String get searchHistoryHint =>
      'যেমন: উচ্চ সোডিয়াম স্ন্যাকস, কম স্কোরের বিস্কুট';

  @override
  String get estimatedValue => 'আনুমানিক';

  @override
  String get disclaimer =>
      'শুধুমাত্র তথ্যগত উদ্দেশ্যে। পেশাদার পুষ্টি পরামর্শের বিকল্প নয়।';
}
