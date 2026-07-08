// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Kannada (`kn`).
class AppLocalizationsKn extends AppLocalizations {
  AppLocalizationsKn([String locale = 'kn']) : super(locale);

  @override
  String get appName => 'NutriMind AI';

  @override
  String get scanProduct => 'ಉತ್ಪನ್ನವನ್ನು ಸ್ಕ್ಯಾನ್ ಮಾಡಿ';

  @override
  String get healthScore => 'ಆರೋಗ್ಯ ಸ್ಕೋರ್';

  @override
  String get excellent => 'ಅತ್ಯುತ್ತಮ';

  @override
  String get good => 'ಉತ್ತಮ';

  @override
  String get fair => 'ಸಾಧಾರಣ';

  @override
  String get poor => 'ಕಳಪೆ';

  @override
  String novaGroup(int group) {
    return 'NOVA ಗುಂಪು $group';
  }

  @override
  String get ingredients => 'ಪದಾರ್ಥಗಳು';

  @override
  String get allergenWarning => 'ಅಲರ್ಜಿ ಎಚ್ಚರಿಕೆ';

  @override
  String allergenDeclared(String allergen) {
    return '$allergen ಇದೆ';
  }

  @override
  String allergenTrace(String allergen) {
    return '$allergen ಅಂಶಗಳಿರಬಹುದು';
  }

  @override
  String get allergenFailSafe =>
      'ಪದಾರ್ಥಗಳ ಪಟ್ಟಿಯನ್ನು ವಿಶ್ವಾಸಾರ್ಹವಾಗಿ ಓದಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ. ಅಲರ್ಜಿಗಳನ್ನು ಕೈಯಾರೆ ಪರಿಶೀಲಿಸಿ.';

  @override
  String get nutritionFacts => 'ಪೋಷಣಾ ಮಾಹಿತಿ';

  @override
  String get per100g => '100ಗ್ರಾಂ ಗೆ';

  @override
  String perServing(num g) {
    final intl.NumberFormat gNumberFormat =
        intl.NumberFormat.decimalPattern(localeName);
    final String gString = gNumberFormat.format(g);

    return 'ಪ್ರತಿ ಸಲಕ್ಕೆ ($gStringಗ್ರಾಂ)';
  }

  @override
  String get energyKcal => 'ಶಕ್ತಿ';

  @override
  String get protein => 'ಪ್ರೋಟೀನ್';

  @override
  String get totalFat => 'ಒಟ್ಟು ಕೊಬ್ಬು';

  @override
  String get saturatedFat => 'ಸ್ಯಾಚುರೇಟೆಡ್ ಕೊಬ್ಬು';

  @override
  String get transFat => 'ಟ್ರಾನ್ಸ್ ಕೊಬ್ಬು';

  @override
  String get carbohydrates => 'ಕಾರ್ಬೋಹೈಡ್ರೇಟ್ಸ್';

  @override
  String get totalSugars => 'ಒಟ್ಟು ಸಕ್ಕರೆ';

  @override
  String get addedSugars => 'ಸೇರಿಸಿದ ಸಕ್ಕರೆ';

  @override
  String get dietaryFibre => 'ಆಹಾರ ನಾರು';

  @override
  String get sodium => 'ಸೋಡಿಯಂ';

  @override
  String get copilotTitle => 'ಪೋಷಣಾ ಕೋ-ಪೈಲಟ್';

  @override
  String get copilotDisclaimer => 'ವೈದ್ಯಕೀಯ ಅಥವಾ ಆಹಾರ ತಜ್ಞರ ಸಲಹೆಗೆ ಬದಲಿಯಲ್ಲ.';

  @override
  String get copilotPlaceholder => 'ಈ ಉತ್ಪನ್ನದ ಬಗ್ಗೆ ಕೇಳಿ…';

  @override
  String get weeklyReport => 'ವಾರದ ವರದಿ';

  @override
  String get mealLog => 'ಊಟದ ದಾಖಲೆ';

  @override
  String get groceryCart => 'ದಿನಸಿ ಬುಟ್ಟಿ';

  @override
  String get alternatives => 'ಆರೋಗ್ಯಕರ ಪರ್ಯಾಯಗಳು';

  @override
  String get budgetPickBadge => 'ಬಜೆಟ್ ಆಯ್ಕೆ';

  @override
  String get thinCategoryMessage =>
      'ಈ ವರ್ಗದಲ್ಲಿ ಹೆಚ್ಚಿನ ಸ್ಕೋರ್ ಹೊಂದಿರುವ ಪರ್ಯಾಯಗಳು ಕಂಡುಬಂದಿಲ್ಲ.';

  @override
  String get notificationSettings => 'ಅಧಿಸೂಚನಾ ಸೆಟ್ಟಿಂಗ್‌ಗಳು';

  @override
  String get weeklyReportNotif => 'ವಾರದ ಪೋಷಣಾ ವರದಿ';

  @override
  String get allergenAlertNotif => 'ಅಲರ್ಜಿ ಎಚ್ಚರಿಕೆಗಳು';

  @override
  String get allergenAlertLockedNote =>
      'ನಿರ್ಣಾಯಕ ಭದ್ರತಾ ಎಚ್ಚರಿಕೆಗಳು — ನಿಷ್ಕ್ರಿಯಗೊಳಿಸಲು ಸಾಧ್ಯವಿಲ್ಲ';

  @override
  String get dataRightsTitle => 'ನಿಮ್ಮ ಡೇಟಾ';

  @override
  String get exportData => 'ನನ್ನ ಡೇಟಾ ರಫ್ತು ಮಾಡಿ';

  @override
  String get deleteAccount => 'ನನ್ನ ಖಾತೆ ಅಳಿಸಿ';

  @override
  String get deleteConfirmTitle => 'ಖಾತೆ ಅಳಿಸಬೇಕೇ?';

  @override
  String get deleteConfirmBody =>
      'ಇದು ನಿಮ್ಮ ಎಲ್ಲಾ ಸ್ಕ್ಯಾನ್‌ಗಳು, ಊಟದ ದಾಖಲೆಗಳು ಮತ್ತು ಪ್ರೊಫೈಲ್ ಡೇಟಾವನ್ನು ಶಾಶ್ವತವಾಗಿ ಅಳಿಸುತ್ತದೆ. ಇದನ್ನು ರದ್ದುಗೊಳಿಸಲಾಗುವುದಿಲ್ಲ.';

  @override
  String get deleteConfirmButton => 'ಶಾಶ್ವತವಾಗಿ ಅಳಿಸಿ';

  @override
  String get childModeWarning => 'ಮಕ್ಕಳ ಸುರಕ್ಷತಾ ಮೋಡ್ ಸಕ್ರಿಯ';

  @override
  String get hypertensionWarning => 'ಹೆಚ್ಚಿನ ಸೋಡಿಯಂ — ರಕ್ತದೊತ್ತಡಕ್ಕೆ ಎಚ್ಚರ';

  @override
  String get diabetesWarning => 'ಹೆಚ್ಚಿನ ಸಕ್ಕರೆ — ಮಧುಮೇಹಕ್ಕೆ ಎಚ್ಚರ';

  @override
  String get searchHistoryTitle => 'ಹುಡುಕಾಟ ಇತಿಹಾಸ';

  @override
  String get searchHistoryHint =>
      'ಉದಾ. ಹೆಚ್ಚಿನ ಸೋಡಿಯಂ ತಿಂಡಿ, ಕಡಿಮೆ ಸ್ಕೋರ್ ಬಿಸ್ಕಿಟ್';

  @override
  String get estimatedValue => 'ಅಂದಾಜು';

  @override
  String get disclaimer =>
      'ಮಾಹಿತಿ ಉದ್ದೇಶಗಳಿಗಾಗಿ ಮಾತ್ರ. ವೃತ್ತಿಪರ ಪೋಷಣಾ ಸಲಹೆಗೆ ಬದಲಿಯಲ್ಲ.';
}
