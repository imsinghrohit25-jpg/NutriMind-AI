// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Tamil (`ta`).
class AppLocalizationsTa extends AppLocalizations {
  AppLocalizationsTa([String locale = 'ta']) : super(locale);

  @override
  String get appName => 'NutriMind AI';

  @override
  String get scanProduct => 'தயாரிப்பை ஸ்கேன் செய்யவும்';

  @override
  String get healthScore => 'சுகாதார மதிப்பெண்';

  @override
  String get excellent => 'சிறந்தது';

  @override
  String get good => 'நல்லது';

  @override
  String get fair => 'சராசரி';

  @override
  String get poor => 'மோசமான';

  @override
  String novaGroup(int group) {
    return 'NOVA குழு $group';
  }

  @override
  String get ingredients => 'பொருட்கள்';

  @override
  String get allergenWarning => 'அலர்ஜி எச்சரிக்கை';

  @override
  String allergenDeclared(String allergen) {
    return '$allergen உள்ளது';
  }

  @override
  String allergenTrace(String allergen) {
    return '$allergen சுவடுகள் இருக்கலாம்';
  }

  @override
  String get allergenFailSafe =>
      'பொருட்கள் பட்டியலை நம்பகத்தன்மையுடன் படிக்க முடியவில்லை. அலர்ஜிகளை கைமுறையாக சரிபார்க்கவும்.';

  @override
  String get nutritionFacts => 'ஊட்டச்சத்து விவரங்கள்';

  @override
  String get per100g => '100கி-க்கு';

  @override
  String perServing(num g) {
    final intl.NumberFormat gNumberFormat =
        intl.NumberFormat.decimalPattern(localeName);
    final String gString = gNumberFormat.format(g);

    return 'ஒரு பரிமாறலுக்கு ($gStringகி)';
  }

  @override
  String get energyKcal => 'ஆற்றல்';

  @override
  String get protein => 'புரதம்';

  @override
  String get totalFat => 'மொத்த கொழுப்பு';

  @override
  String get saturatedFat => 'நிறைவுற்ற கொழுப்பு';

  @override
  String get transFat => 'டிரான்ஸ் கொழுப்பு';

  @override
  String get carbohydrates => 'கார்போஹைட்ரேட்';

  @override
  String get totalSugars => 'மொத்த சர்க்கரை';

  @override
  String get addedSugars => 'சேர்க்கப்பட்ட சர்க்கரை';

  @override
  String get dietaryFibre => 'உணவு நார்ச்சத்து';

  @override
  String get sodium => 'சோடியம்';

  @override
  String get copilotTitle => 'ஊட்டச்சத்து துணைவர்';

  @override
  String get copilotDisclaimer =>
      'மருத்துவ அல்லது உணவியல் ஆலோசனையின் மாற்றாக அல்ல.';

  @override
  String get copilotPlaceholder => 'இந்த தயாரிப்பு பற்றி கேளுங்கள்…';

  @override
  String get weeklyReport => 'வாராந்திர அறிக்கை';

  @override
  String get mealLog => 'உணவு பதிவு';

  @override
  String get groceryCart => 'மளிகை கூடை';

  @override
  String get alternatives => 'ஆரோக்கியமான மாற்றுகள்';

  @override
  String get budgetPickBadge => 'பட்ஜெட் தேர்வு';

  @override
  String get thinCategoryMessage =>
      'இந்த வகையில் சிறந்த மதிப்பெண் கொண்ட மாற்றுகள் எதுவும் கிடைக்கவில்லை.';

  @override
  String get notificationSettings => 'அறிவிப்பு அமைப்புகள்';

  @override
  String get weeklyReportNotif => 'வாராந்திர ஊட்டச்சத்து அறிக்கை';

  @override
  String get allergenAlertNotif => 'அலர்ஜி எச்சரிக்கைகள்';

  @override
  String get allergenAlertLockedNote =>
      'முக்கியமான பாதுகாப்பு எச்சரிக்கைகள் — முடக்க முடியாது';

  @override
  String get dataRightsTitle => 'உங்கள் தரவு';

  @override
  String get exportData => 'என் தரவை ஏற்றுமதி செய்';

  @override
  String get deleteAccount => 'என் கணக்கை நீக்கு';

  @override
  String get deleteConfirmTitle => 'கணக்கை நீக்கவா?';

  @override
  String get deleteConfirmBody =>
      'உங்கள் அனைத்து ஸ்கேன்கள், உணவு பதிவுகள் மற்றும் சுயவிவர தரவு நிரந்தரமாக அழிக்கப்படும். இதை மீண்டும் செயல்தவிர்க்க முடியாது.';

  @override
  String get deleteConfirmButton => 'நிரந்தரமாக நீக்கு';

  @override
  String get childModeWarning => 'குழந்தை பாதுகாப்பு முறை செயலில் உள்ளது';

  @override
  String get hypertensionWarning =>
      'அதிக சோடியம் — உயர் இரத்த அழுத்தத்திற்கு எச்சரிக்கை';

  @override
  String get diabetesWarning => 'அதிக சர்க்கரை — நீரிழிவுக்கு எச்சரிக்கை';

  @override
  String get searchHistoryTitle => 'தேடல் வரலாறு';

  @override
  String get searchHistoryHint =>
      'எ.கா. அதிக சோடியம் தின்பண்டங்கள், குறைந்த மதிப்பெண் பிஸ்கட்';

  @override
  String get estimatedValue => 'மதிப்பீடு';

  @override
  String get disclaimer =>
      'தகவல் நோக்கங்களுக்கு மட்டுமே. தொழில்முறை ஊட்டச்சத்து ஆலோசனையின் மாற்றாக அல்ல.';
}
