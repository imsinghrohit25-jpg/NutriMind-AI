// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for French (`fr`).
class AppLocalizationsFr extends AppLocalizations {
  AppLocalizationsFr([String locale = 'fr']) : super(locale);

  @override
  String get appName => 'NutriMind IA';

  @override
  String get scanProduct => 'Scanner un produit';

  @override
  String get healthScore => 'Score Santé';

  @override
  String get excellent => 'Excellent';

  @override
  String get good => 'Bon';

  @override
  String get fair => 'Passable';

  @override
  String get poor => 'Mauvais';

  @override
  String novaGroup(int group) {
    return 'Groupe NOVA $group';
  }

  @override
  String get ingredients => 'Ingrédients';

  @override
  String get allergenWarning => 'Avertissement Allergène';

  @override
  String allergenDeclared(String allergen) {
    return 'Contient $allergen';
  }

  @override
  String allergenTrace(String allergen) {
    return 'Peut contenir des traces de $allergen';
  }

  @override
  String get allergenFailSafe =>
      'Nous n\'avons pas pu lire la liste des ingrédients de manière fiable. Vérifiez les allergènes manuellement.';

  @override
  String get nutritionFacts => 'Informations Nutritionnelles';

  @override
  String get per100g => 'pour 100g';

  @override
  String perServing(num g) {
    final intl.NumberFormat gNumberFormat =
        intl.NumberFormat.decimalPattern(localeName);
    final String gString = gNumberFormat.format(g);

    return 'par portion (${gString}g)';
  }

  @override
  String get energyKcal => 'Énergie';

  @override
  String get protein => 'Protéines';

  @override
  String get totalFat => 'Lipides Totaux';

  @override
  String get saturatedFat => 'Acides Gras Saturés';

  @override
  String get transFat => 'Acides Gras Trans';

  @override
  String get carbohydrates => 'Glucides';

  @override
  String get totalSugars => 'Sucres Totaux';

  @override
  String get addedSugars => 'Sucres Ajoutés';

  @override
  String get dietaryFibre => 'Fibres Alimentaires';

  @override
  String get sodium => 'Sodium';

  @override
  String get copilotTitle => 'Copilote Nutritionnel';

  @override
  String get copilotDisclaimer =>
      'Ne remplace pas un avis médical ou diététique.';

  @override
  String get copilotPlaceholder => 'Posez une question sur ce produit…';

  @override
  String get weeklyReport => 'Rapport Hebdomadaire';

  @override
  String get mealLog => 'Journal des Repas';

  @override
  String get groceryCart => 'Panier';

  @override
  String get alternatives => 'Alternatives Plus Saines';

  @override
  String get budgetPickBadge => 'Bon rapport qualité-prix';

  @override
  String get thinCategoryMessage =>
      'Aucune alternative mieux notée trouvée dans cette catégorie.';

  @override
  String get notificationSettings => 'Paramètres de Notifications';

  @override
  String get weeklyReportNotif => 'Rapport nutritionnel hebdomadaire';

  @override
  String get allergenAlertNotif => 'Alertes allergènes';

  @override
  String get allergenAlertLockedNote =>
      'Alertes de sécurité critiques — ne peuvent pas être désactivées';

  @override
  String get dataRightsTitle => 'Vos Données';

  @override
  String get exportData => 'Exporter mes données';

  @override
  String get deleteAccount => 'Supprimer mon compte';

  @override
  String get deleteConfirmTitle => 'Supprimer le compte ?';

  @override
  String get deleteConfirmBody =>
      'Cela supprimera définitivement tous vos scans, journaux de repas et données de profil. Cette action est irréversible.';

  @override
  String get deleteConfirmButton => 'Supprimer définitivement';

  @override
  String get childModeWarning => 'Mode Sécurité Enfant Actif';

  @override
  String get hypertensionWarning =>
      'Riche en sodium — attention pour l\'hypertension';

  @override
  String get diabetesWarning => 'Riche en sucre — attention pour le diabète';

  @override
  String get searchHistoryTitle => 'Historique de Recherche';

  @override
  String get searchHistoryHint =>
      'ex. snacks riches en sodium, biscuits mal notés';

  @override
  String get estimatedValue => 'Estimé';

  @override
  String get disclaimer =>
      'À titre informatif uniquement. Ne remplace pas un conseil nutritionnel professionnel.';
}
