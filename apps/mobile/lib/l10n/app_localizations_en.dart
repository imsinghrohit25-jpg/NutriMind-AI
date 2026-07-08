// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class AppLocalizationsEn extends AppLocalizations {
  AppLocalizationsEn([String locale = 'en']) : super(locale);

  @override
  String get appName => 'NutriMind AI';

  @override
  String get scanProduct => 'Scan a product';

  @override
  String get healthScore => 'Health Score';

  @override
  String get excellent => 'Excellent';

  @override
  String get good => 'Good';

  @override
  String get fair => 'Fair';

  @override
  String get poor => 'Poor';

  @override
  String novaGroup(int group) {
    return 'NOVA Group $group';
  }

  @override
  String get ingredients => 'Ingredients';

  @override
  String get allergenWarning => 'Allergen Warning';

  @override
  String allergenDeclared(String allergen) {
    return 'Contains $allergen';
  }

  @override
  String allergenTrace(String allergen) {
    return 'May contain traces of $allergen';
  }

  @override
  String get allergenFailSafe =>
      'We could not reliably read the ingredient list. Check for allergens manually.';

  @override
  String get nutritionFacts => 'Nutrition Facts';

  @override
  String get per100g => 'per 100g';

  @override
  String perServing(num g) {
    final intl.NumberFormat gNumberFormat =
        intl.NumberFormat.decimalPattern(localeName);
    final String gString = gNumberFormat.format(g);

    return 'per serving (${gString}g)';
  }

  @override
  String get energyKcal => 'Energy';

  @override
  String get protein => 'Protein';

  @override
  String get totalFat => 'Total Fat';

  @override
  String get saturatedFat => 'Saturated Fat';

  @override
  String get transFat => 'Trans Fat';

  @override
  String get carbohydrates => 'Carbohydrates';

  @override
  String get totalSugars => 'Total Sugars';

  @override
  String get addedSugars => 'Added Sugars';

  @override
  String get dietaryFibre => 'Dietary Fibre';

  @override
  String get sodium => 'Sodium';

  @override
  String get copilotTitle => 'Nutrition Copilot';

  @override
  String get copilotDisclaimer =>
      'Not a substitute for medical or dietetic advice.';

  @override
  String get copilotPlaceholder => 'Ask about this product…';

  @override
  String get weeklyReport => 'Weekly Report';

  @override
  String get mealLog => 'Meal Log';

  @override
  String get groceryCart => 'Grocery Cart';

  @override
  String get alternatives => 'Healthier Alternatives';

  @override
  String get budgetPickBadge => 'Budget pick';

  @override
  String get thinCategoryMessage =>
      'No better-scoring alternatives found in this category.';

  @override
  String get notificationSettings => 'Notification Settings';

  @override
  String get weeklyReportNotif => 'Weekly nutrition report';

  @override
  String get allergenAlertNotif => 'Allergen alerts';

  @override
  String get allergenAlertLockedNote =>
      'Critical safety alerts — cannot be disabled';

  @override
  String get dataRightsTitle => 'Your Data';

  @override
  String get exportData => 'Export my data';

  @override
  String get deleteAccount => 'Delete my account';

  @override
  String get deleteConfirmTitle => 'Delete account?';

  @override
  String get deleteConfirmBody =>
      'This will permanently erase all your scans, meal logs, and profile data. This cannot be undone.';

  @override
  String get deleteConfirmButton => 'Delete permanently';

  @override
  String get childModeWarning => 'Child Safety Mode Active';

  @override
  String get hypertensionWarning => 'High sodium — caution for hypertension';

  @override
  String get diabetesWarning => 'High sugar — caution for diabetes';

  @override
  String get searchHistoryTitle => 'Search History';

  @override
  String get searchHistoryHint => 'e.g. high sodium snacks, low score biscuits';

  @override
  String get estimatedValue => 'Estimated';

  @override
  String get disclaimer =>
      'For informational purposes only. Not a substitute for professional nutritional advice.';
}
