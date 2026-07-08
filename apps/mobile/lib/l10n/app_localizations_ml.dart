// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Malayalam (`ml`).
class AppLocalizationsMl extends AppLocalizations {
  AppLocalizationsMl([String locale = 'ml']) : super(locale);

  @override
  String get appName => 'NutriMind AI';

  @override
  String get scanProduct => 'ഉൽപ്പന്നം സ്കാൻ ചെയ്യുക';

  @override
  String get healthScore => 'ആരോഗ്യ സ്കോർ';

  @override
  String get excellent => 'മികച്ചത്';

  @override
  String get good => 'നല്ലത്';

  @override
  String get fair => 'ശരാശരി';

  @override
  String get poor => 'മോശം';

  @override
  String novaGroup(int group) {
    return 'NOVA ഗ്രൂപ്പ് $group';
  }

  @override
  String get ingredients => 'ചേരുവകൾ';

  @override
  String get allergenWarning => 'അലർജൻ മുന്നറിയിപ്പ്';

  @override
  String allergenDeclared(String allergen) {
    return '$allergen അടങ്ങിയിരിക്കുന്നു';
  }

  @override
  String allergenTrace(String allergen) {
    return '$allergen-ന്റെ അംശം ഉണ്ടായിരിക്കാം';
  }

  @override
  String get allergenFailSafe =>
      'ചേരുവകളുടെ ലിസ്റ്റ് വിശ്വസനീയമായി വായിക്കാൻ കഴിഞ്ഞില്ല. അലർജൻ മാനുവലായി പരിശോധിക്കുക.';

  @override
  String get nutritionFacts => 'പോഷക വിവരങ്ങൾ';

  @override
  String get per100g => '100ഗ്രാം ന്';

  @override
  String perServing(num g) {
    final intl.NumberFormat gNumberFormat =
        intl.NumberFormat.decimalPattern(localeName);
    final String gString = gNumberFormat.format(g);

    return 'ഒരു സർവ്വിങ്ങിന് ($gStringഗ്രാം)';
  }

  @override
  String get energyKcal => 'ഊർജം';

  @override
  String get protein => 'പ്രോട്ടീൻ';

  @override
  String get totalFat => 'ആകെ കൊഴുപ്പ്';

  @override
  String get saturatedFat => 'സാച്ചുറേറ്റഡ് കൊഴുപ്പ്';

  @override
  String get transFat => 'ട്രാൻസ് കൊഴുപ്പ്';

  @override
  String get carbohydrates => 'കാർബോഹൈഡ്രേറ്റ്';

  @override
  String get totalSugars => 'ആകെ പഞ്ചസാര';

  @override
  String get addedSugars => 'ചേർത്ത പഞ്ചസാര';

  @override
  String get dietaryFibre => 'ഭക്ഷ്യ നാര്';

  @override
  String get sodium => 'സോഡിയം';

  @override
  String get copilotTitle => 'പോഷക കോ-പൈലറ്റ്';

  @override
  String get copilotDisclaimer =>
      'വൈദ്യ അല്ലെങ്കിൽ ഡയറ്ററ്റിക് ഉപദേശത്തിന് പകരമല്ല.';

  @override
  String get copilotPlaceholder => 'ഈ ഉൽപ്പന്നത്തെ കുറിച്ച് ചോദിക്കുക…';

  @override
  String get weeklyReport => 'വാരാന്ത്യ റിപ്പോർട്ട്';

  @override
  String get mealLog => 'ഭക്ഷണ ലോഗ്';

  @override
  String get groceryCart => 'ഗ്രോസറി കാർട്ട്';

  @override
  String get alternatives => 'ആരോഗ്യകരമായ ബദലുകൾ';

  @override
  String get budgetPickBadge => 'ബഡ്ജറ്റ് പിക്ക്';

  @override
  String get thinCategoryMessage =>
      'ഈ വിഭാഗത്തിൽ മികച്ച സ്കോർ ഉള്ള ബദലുകൾ ഒന്നും കണ്ടെത്തിയില്ല.';

  @override
  String get notificationSettings => 'അറിയിപ്പ് ക്രമീകരണങ്ങൾ';

  @override
  String get weeklyReportNotif => 'വാരാന്ത്യ പോഷക റിപ്പോർട്ട്';

  @override
  String get allergenAlertNotif => 'അലർജൻ മുന്നറിയിപ്പുകൾ';

  @override
  String get allergenAlertLockedNote =>
      'നിർണ്ണായക സുരക്ഷാ മുന്നറിയിപ്പുകൾ — നിഷ്ക്രിയമാക്കാൻ കഴിയില്ല';

  @override
  String get dataRightsTitle => 'നിങ്ങളുടെ ഡേറ്റ';

  @override
  String get exportData => 'എന്റെ ഡേറ്റ എക്സ്പോർട്ട് ചെയ്യുക';

  @override
  String get deleteAccount => 'എന്റെ അക്കൗണ്ട് ഇല്ലാതാക്കുക';

  @override
  String get deleteConfirmTitle => 'അക്കൗണ്ട് ഇല്ലാതാക്കണോ?';

  @override
  String get deleteConfirmBody =>
      'ഇത് നിങ്ങളുടെ എല്ലാ സ്കാനുകളും ഭക്ഷണ ലോഗുകളും പ്രൊഫൈൽ ഡേറ്റയും സ്ഥിരമായി ഇല്ലാതാക്കും. ഇത് പഴയപടിയാക്കാൻ കഴിയില്ല.';

  @override
  String get deleteConfirmButton => 'സ്ഥിരമായി ഇല്ലാതാക്കുക';

  @override
  String get childModeWarning => 'ശിശു സുരക്ഷാ മോഡ് സജീവം';

  @override
  String get hypertensionWarning =>
      'ഉയർന്ന സോഡിയം — ഉയർന്ന രക്തസമ്മർദ്ദത്തിന് ശ്രദ്ധ';

  @override
  String get diabetesWarning => 'ഉയർന്ന പഞ്ചസാര — പ്രമേഹത്തിന് ശ്രദ്ധ';

  @override
  String get searchHistoryTitle => 'തിരയൽ ചരിത്രം';

  @override
  String get searchHistoryHint =>
      'ഉദാ. ഉയർന്ന സോഡിയം സ്നാക്കുകൾ, കുറഞ്ഞ സ്കോർ ബിസ്ക്കറ്റ്';

  @override
  String get estimatedValue => 'ഏകദേശ';

  @override
  String get disclaimer =>
      'വിവര ആവശ്യങ്ങൾക്ക് മാത്രം. പ്രൊഫഷണൽ പോഷക ഉപദേശത്തിന് പകരമല്ല.';
}
