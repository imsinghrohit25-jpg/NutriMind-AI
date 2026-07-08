// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Panjabi Punjabi (`pa`).
class AppLocalizationsPa extends AppLocalizations {
  AppLocalizationsPa([String locale = 'pa']) : super(locale);

  @override
  String get appName => 'NutriMind AI';

  @override
  String get scanProduct => 'ਉਤਪਾਦ ਸਕੈਨ ਕਰੋ';

  @override
  String get healthScore => 'ਸਿਹਤ ਸਕੋਰ';

  @override
  String get excellent => 'ਉੱਤਮ';

  @override
  String get good => 'ਚੰਗਾ';

  @override
  String get fair => 'ਔਸਤ';

  @override
  String get poor => 'ਮਾੜਾ';

  @override
  String novaGroup(int group) {
    return 'NOVA ਸਮੂਹ $group';
  }

  @override
  String get ingredients => 'ਸਮੱਗਰੀ';

  @override
  String get allergenWarning => 'ਐਲਰਜਨ ਚੇਤਾਵਨੀ';

  @override
  String allergenDeclared(String allergen) {
    return '$allergen ਸ਼ਾਮਲ ਹੈ';
  }

  @override
  String allergenTrace(String allergen) {
    return '$allergen ਦੇ ਨਿਸ਼ਾਨ ਹੋ ਸਕਦੇ ਹਨ';
  }

  @override
  String get allergenFailSafe =>
      'ਸਮੱਗਰੀ ਸੂਚੀ ਭਰੋਸੇਯੋਗ ਤਰੀਕੇ ਨਾਲ ਨਹੀਂ ਪੜ੍ਹੀ ਜਾ ਸਕੀ। ਐਲਰਜਨ ਦੀ ਦਸਤੀ ਜਾਂਚ ਕਰੋ।';

  @override
  String get nutritionFacts => 'ਪੋਸ਼ਣ ਤੱਥ';

  @override
  String get per100g => 'ਪ੍ਰਤੀ 100ਗ੍ਰਾ';

  @override
  String perServing(num g) {
    final intl.NumberFormat gNumberFormat =
        intl.NumberFormat.decimalPattern(localeName);
    final String gString = gNumberFormat.format(g);

    return 'ਪ੍ਰਤੀ ਪਰੋਸਣ ($gStringਗ੍ਰਾ)';
  }

  @override
  String get energyKcal => 'ਊਰਜਾ';

  @override
  String get protein => 'ਪ੍ਰੋਟੀਨ';

  @override
  String get totalFat => 'ਕੁੱਲ ਚਰਬੀ';

  @override
  String get saturatedFat => 'ਸੰਤ੍ਰਿਪਤ ਚਰਬੀ';

  @override
  String get transFat => 'ਟ੍ਰਾਂਸ ਚਰਬੀ';

  @override
  String get carbohydrates => 'ਕਾਰਬੋਹਾਈਡ੍ਰੇਟ';

  @override
  String get totalSugars => 'ਕੁੱਲ ਸ਼ੱਕਰ';

  @override
  String get addedSugars => 'ਜੋੜੀ ਗਈ ਸ਼ੱਕਰ';

  @override
  String get dietaryFibre => 'ਖੁਰਾਕੀ ਫਾਈਬਰ';

  @override
  String get sodium => 'ਸੋਡੀਅਮ';

  @override
  String get copilotTitle => 'ਪੋਸ਼ਣ ਕੋਪਾਇਲਟ';

  @override
  String get copilotDisclaimer => 'ਡਾਕਟਰੀ ਜਾਂ ਖੁਰਾਕ ਸੰਬੰਧੀ ਸਲਾਹ ਦਾ ਬਦਲ ਨਹੀਂ।';

  @override
  String get copilotPlaceholder => 'ਇਸ ਉਤਪਾਦ ਬਾਰੇ ਪੁੱਛੋ…';

  @override
  String get weeklyReport => 'ਹਫ਼ਤਾਵਾਰੀ ਰਿਪੋਰਟ';

  @override
  String get mealLog => 'ਭੋਜਨ ਲੌਗ';

  @override
  String get groceryCart => 'ਖਰੀਦਾਰੀ ਟੋਕਰੀ';

  @override
  String get alternatives => 'ਵਧੇਰੇ ਸਿਹਤਮੰਦ ਵਿਕਲਪ';

  @override
  String get budgetPickBadge => 'ਬਜਟ ਪਿਕ';

  @override
  String get thinCategoryMessage =>
      'ਇਸ ਸ਼੍ਰੇਣੀ ਵਿੱਚ ਬਿਹਤਰ ਸਕੋਰ ਵਾਲੇ ਕੋਈ ਵਿਕਲਪ ਨਹੀਂ ਮਿਲੇ।';

  @override
  String get notificationSettings => 'ਸੂਚਨਾ ਸੈੱਟਿੰਗਾਂ';

  @override
  String get weeklyReportNotif => 'ਹਫ਼ਤਾਵਾਰੀ ਪੋਸ਼ਣ ਰਿਪੋਰਟ';

  @override
  String get allergenAlertNotif => 'ਐਲਰਜਨ ਚੇਤਾਵਨੀਆਂ';

  @override
  String get allergenAlertLockedNote =>
      'ਨਾਜ਼ੁਕ ਸੁਰੱਖਿਆ ਚੇਤਾਵਨੀਆਂ — ਅਯੋਗ ਨਹੀਂ ਕੀਤੀਆਂ ਜਾ ਸਕਦੀਆਂ';

  @override
  String get dataRightsTitle => 'ਤੁਹਾਡਾ ਡੇਟਾ';

  @override
  String get exportData => 'ਮੇਰਾ ਡੇਟਾ ਨਿਰਯਾਤ ਕਰੋ';

  @override
  String get deleteAccount => 'ਮੇਰਾ ਖਾਤਾ ਮਿਟਾਓ';

  @override
  String get deleteConfirmTitle => 'ਖਾਤਾ ਮਿਟਾਓ?';

  @override
  String get deleteConfirmBody =>
      'ਇਹ ਤੁਹਾਡੇ ਸਾਰੇ ਸਕੈਨ, ਭੋਜਨ ਲੌਗ ਅਤੇ ਪ੍ਰੋਫਾਈਲ ਡੇਟਾ ਨੂੰ ਸਥਾਈ ਤੌਰ \'ਤੇ ਮਿਟਾ ਦੇਵੇਗਾ। ਇਹ ਵਾਪਸ ਨਹੀਂ ਕੀਤਾ ਜਾ ਸਕਦਾ।';

  @override
  String get deleteConfirmButton => 'ਸਥਾਈ ਤੌਰ \'ਤੇ ਮਿਟਾਓ';

  @override
  String get childModeWarning => 'ਬੱਚੇ ਦੀ ਸੁਰੱਖਿਆ ਮੋਡ ਸਕਿਰਿਆ';

  @override
  String get hypertensionWarning => 'ਉੱਚ ਸੋਡੀਅਮ — ਹਾਈਪਰਟੈਨਸ਼ਨ ਲਈ ਸਾਵਧਾਨੀ';

  @override
  String get diabetesWarning => 'ਉੱਚ ਸ਼ੱਕਰ — ਡਾਇਬਿਟੀਜ਼ ਲਈ ਸਾਵਧਾਨੀ';

  @override
  String get searchHistoryTitle => 'ਖੋਜ ਇਤਿਹਾਸ';

  @override
  String get searchHistoryHint => 'ਜਿਵੇਂ: ਉੱਚ ਸੋਡੀਅਮ ਸਨੈਕਸ, ਘੱਟ ਸਕੋਰ ਬਿਸਕੁਟ';

  @override
  String get estimatedValue => 'ਅਨੁਮਾਨਿਤ';

  @override
  String get disclaimer =>
      'ਸਿਰਫ਼ ਜਾਣਕਾਰੀ ਦੇ ਉਦੇਸ਼ਾਂ ਲਈ। ਪੇਸ਼ੇਵਰ ਪੋਸ਼ਣ ਸਲਾਹ ਦਾ ਬਦਲ ਨਹੀਂ।';
}
