// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for German (`de`).
class AppLocalizationsDe extends AppLocalizations {
  AppLocalizationsDe([String locale = 'de']) : super(locale);

  @override
  String get appName => 'NutriMind KI';

  @override
  String get scanProduct => 'Produkt scannen';

  @override
  String get healthScore => 'Gesundheitswert';

  @override
  String get excellent => 'Ausgezeichnet';

  @override
  String get good => 'Gut';

  @override
  String get fair => 'Mäßig';

  @override
  String get poor => 'Schlecht';

  @override
  String novaGroup(int group) {
    return 'NOVA-Gruppe $group';
  }

  @override
  String get ingredients => 'Zutaten';

  @override
  String get allergenWarning => 'Allergenwarnung';

  @override
  String allergenDeclared(String allergen) {
    return 'Enthält $allergen';
  }

  @override
  String allergenTrace(String allergen) {
    return 'Kann Spuren von $allergen enthalten';
  }

  @override
  String get allergenFailSafe =>
      'Die Zutatenliste konnte nicht zuverlässig gelesen werden. Bitte prüfen Sie Allergene manuell.';

  @override
  String get nutritionFacts => 'Nährwertangaben';

  @override
  String get per100g => 'pro 100g';

  @override
  String perServing(num g) {
    final intl.NumberFormat gNumberFormat =
        intl.NumberFormat.decimalPattern(localeName);
    final String gString = gNumberFormat.format(g);

    return 'pro Portion (${gString}g)';
  }

  @override
  String get energyKcal => 'Energie';

  @override
  String get protein => 'Eiweiß';

  @override
  String get totalFat => 'Fett gesamt';

  @override
  String get saturatedFat => 'Gesättigte Fettsäuren';

  @override
  String get transFat => 'Transfettsäuren';

  @override
  String get carbohydrates => 'Kohlenhydrate';

  @override
  String get totalSugars => 'Zucker gesamt';

  @override
  String get addedSugars => 'Zugesetzter Zucker';

  @override
  String get dietaryFibre => 'Ballaststoffe';

  @override
  String get sodium => 'Natrium';

  @override
  String get copilotTitle => 'Ernährungs-Copilot';

  @override
  String get copilotDisclaimer =>
      'Kein Ersatz für ärztlichen oder diätetischen Rat.';

  @override
  String get copilotPlaceholder => 'Fragen Sie zu diesem Produkt…';

  @override
  String get weeklyReport => 'Wochenbericht';

  @override
  String get mealLog => 'Mahlzeitenprotokoll';

  @override
  String get groceryCart => 'Einkaufswagen';

  @override
  String get alternatives => 'Gesündere Alternativen';

  @override
  String get budgetPickBadge => 'Preis-Leistungs-Tipp';

  @override
  String get thinCategoryMessage =>
      'Keine besser bewerteten Alternativen in dieser Kategorie gefunden.';

  @override
  String get notificationSettings => 'Benachrichtigungseinstellungen';

  @override
  String get weeklyReportNotif => 'Wöchentlicher Ernährungsbericht';

  @override
  String get allergenAlertNotif => 'Allergen-Warnungen';

  @override
  String get allergenAlertLockedNote =>
      'Kritische Sicherheitswarnungen — können nicht deaktiviert werden';

  @override
  String get dataRightsTitle => 'Ihre Daten';

  @override
  String get exportData => 'Meine Daten exportieren';

  @override
  String get deleteAccount => 'Mein Konto löschen';

  @override
  String get deleteConfirmTitle => 'Konto löschen?';

  @override
  String get deleteConfirmBody =>
      'Dadurch werden alle Ihre Scans, Mahlzeitenprotokolle und Profildaten dauerhaft gelöscht. Dies kann nicht rückgängig gemacht werden.';

  @override
  String get deleteConfirmButton => 'Dauerhaft löschen';

  @override
  String get childModeWarning => 'Kindersicherungsmodus aktiv';

  @override
  String get hypertensionWarning => 'Viel Natrium — Vorsicht bei Bluthochdruck';

  @override
  String get diabetesWarning => 'Viel Zucker — Vorsicht bei Diabetes';

  @override
  String get searchHistoryTitle => 'Suchverlauf';

  @override
  String get searchHistoryHint =>
      'z.B. natriumreiche Snacks, Kekse mit niedrigem Score';

  @override
  String get estimatedValue => 'Geschätzt';

  @override
  String get disclaimer =>
      'Nur zu Informationszwecken. Kein Ersatz für professionelle Ernährungsberatung.';
}
