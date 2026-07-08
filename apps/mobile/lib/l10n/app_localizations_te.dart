// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Telugu (`te`).
class AppLocalizationsTe extends AppLocalizations {
  AppLocalizationsTe([String locale = 'te']) : super(locale);

  @override
  String get appName => 'NutriMind AI';

  @override
  String get scanProduct => 'ఉత్పత్తిని స్కాన్ చేయండి';

  @override
  String get healthScore => 'ఆరోగ్య స్కోరు';

  @override
  String get excellent => 'అద్భుతం';

  @override
  String get good => 'మంచిది';

  @override
  String get fair => 'సాధారణ';

  @override
  String get poor => 'చెడ్డది';

  @override
  String novaGroup(int group) {
    return 'NOVA సమూహం $group';
  }

  @override
  String get ingredients => 'పదార్థాలు';

  @override
  String get allergenWarning => 'అలర్జీ హెచ్చరిక';

  @override
  String allergenDeclared(String allergen) {
    return '$allergen ఉంది';
  }

  @override
  String allergenTrace(String allergen) {
    return '$allergen జాడలు ఉండవచ్చు';
  }

  @override
  String get allergenFailSafe =>
      'పదార్థాల జాబితాను విశ్వసనీయంగా చదవడం సాధ్యం కాలేదు. అలర్జీలను మాన్యువల్‌గా తనిఖీ చేయండి.';

  @override
  String get nutritionFacts => 'పోషక వివరాలు';

  @override
  String get per100g => '100గ్రా కు';

  @override
  String perServing(num g) {
    final intl.NumberFormat gNumberFormat =
        intl.NumberFormat.decimalPattern(localeName);
    final String gString = gNumberFormat.format(g);

    return 'ప్రతి వడ్డింపుకు ($gStringగ్రా)';
  }

  @override
  String get energyKcal => 'శక్తి';

  @override
  String get protein => 'ప్రోటీన్';

  @override
  String get totalFat => 'మొత్తం కొవ్వు';

  @override
  String get saturatedFat => 'సంతృప్త కొవ్వు';

  @override
  String get transFat => 'ట్రాన్స్ కొవ్వు';

  @override
  String get carbohydrates => 'కార్బోహైడ్రేట్లు';

  @override
  String get totalSugars => 'మొత్తం చక్కెర';

  @override
  String get addedSugars => 'జోడించిన చక్కెర';

  @override
  String get dietaryFibre => 'ఆహార పీచు';

  @override
  String get sodium => 'సోడియం';

  @override
  String get copilotTitle => 'పోషణ కో-పైలట్';

  @override
  String get copilotDisclaimer =>
      'వైద్య లేదా ఆహార నిపుణుల సలహాకు ప్రత్యామ్నాయం కాదు.';

  @override
  String get copilotPlaceholder => 'ఈ ఉత్పత్తి గురించి అడగండి…';

  @override
  String get weeklyReport => 'వారపు నివేదిక';

  @override
  String get mealLog => 'భోజన లాగ్';

  @override
  String get groceryCart => 'కిరాణా బుట్ట';

  @override
  String get alternatives => 'ఆరోగ్యకరమైన ప్రత్యామ్నాయాలు';

  @override
  String get budgetPickBadge => 'బడ్జెట్ ఎంపిక';

  @override
  String get thinCategoryMessage =>
      'ఈ వర్గంలో అధిక స్కోరు ఉన్న ప్రత్యామ్నాయాలు ఏవీ కనుగొనబడలేదు.';

  @override
  String get notificationSettings => 'నోటిఫికేషన్ సెట్టింగ్‌లు';

  @override
  String get weeklyReportNotif => 'వారపు పోషణ నివేదిక';

  @override
  String get allergenAlertNotif => 'అలర్జీ హెచ్చరికలు';

  @override
  String get allergenAlertLockedNote =>
      'క్లిష్టమైన భద్రతా హెచ్చరికలు — నిలిపివేయలేరు';

  @override
  String get dataRightsTitle => 'మీ డేటా';

  @override
  String get exportData => 'నా డేటాను ఎగుమతి చేయండి';

  @override
  String get deleteAccount => 'నా ఖాతాను తొలగించండి';

  @override
  String get deleteConfirmTitle => 'ఖాతాను తొలగించాలా?';

  @override
  String get deleteConfirmBody =>
      'ఇది మీ అన్ని స్కాన్‌లు, భోజన లాగ్‌లు మరియు ప్రొఫైల్ డేటాను శాశ్వతంగా తొలగిస్తుంది. ఇది రద్దు చేయలేరు.';

  @override
  String get deleteConfirmButton => 'శాశ్వతంగా తొలగించండి';

  @override
  String get childModeWarning => 'పిల్లల భద్రతా మోడ్ సక్రియంగా ఉంది';

  @override
  String get hypertensionWarning =>
      'అధిక సోడియం — రక్తపోటు ఉన్నవారికి జాగ్రత్త';

  @override
  String get diabetesWarning => 'అధిక చక్కెర — మధుమేహానికి జాగ్రత్త';

  @override
  String get searchHistoryTitle => 'శోధన చరిత్ర';

  @override
  String get searchHistoryHint =>
      'ఉదా. అధిక సోడియం స్నాక్స్, తక్కువ స్కోరు బిస్కెట్లు';

  @override
  String get estimatedValue => 'అంచనా';

  @override
  String get disclaimer =>
      'సమాచార ప్రయోజనాలకు మాత్రమే. వృత్తిపర పోషణ సలహాకు ప్రత్యామ్నాయం కాదు.';
}
