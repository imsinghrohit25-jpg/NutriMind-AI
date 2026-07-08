// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Gujarati (`gu`).
class AppLocalizationsGu extends AppLocalizations {
  AppLocalizationsGu([String locale = 'gu']) : super(locale);

  @override
  String get appName => 'NutriMind AI';

  @override
  String get scanProduct => 'ઉત્પાદ સ્કૅન કરો';

  @override
  String get healthScore => 'આરોગ્ય સ્કોર';

  @override
  String get excellent => 'ઉત્તમ';

  @override
  String get good => 'સારું';

  @override
  String get fair => 'સાધારણ';

  @override
  String get poor => 'ખરાબ';

  @override
  String novaGroup(int group) {
    return 'NOVA જૂથ $group';
  }

  @override
  String get ingredients => 'સામગ્રી';

  @override
  String get allergenWarning => 'એલર્જન ચેતવણી';

  @override
  String allergenDeclared(String allergen) {
    return '$allergen ધરાવે છે';
  }

  @override
  String allergenTrace(String allergen) {
    return '$allergenના અંશ હોઈ શકે છે';
  }

  @override
  String get allergenFailSafe =>
      'સામગ્રીની સૂચિ વિશ્વસનીય રીતે વાંચી શકાઈ નથી. એલર્જન હાથથી તપાસો.';

  @override
  String get nutritionFacts => 'પોષણ તથ્યો';

  @override
  String get per100g => 'દર 100ગ્રા';

  @override
  String perServing(num g) {
    final intl.NumberFormat gNumberFormat =
        intl.NumberFormat.decimalPattern(localeName);
    final String gString = gNumberFormat.format(g);

    return 'દર પિરસવાથી ($gStringગ્રા)';
  }

  @override
  String get energyKcal => 'ઊર્જા';

  @override
  String get protein => 'પ્રોટીન';

  @override
  String get totalFat => 'કુલ ચરબી';

  @override
  String get saturatedFat => 'સંતૃપ્ત ચરબી';

  @override
  String get transFat => 'ટ્રાન્સ ચરબી';

  @override
  String get carbohydrates => 'કાર્બોહાઇડ્રેટ';

  @override
  String get totalSugars => 'કુલ ખાંડ';

  @override
  String get addedSugars => 'ઉમેરાયેલ ખાંડ';

  @override
  String get dietaryFibre => 'આહાર ફાઇબર';

  @override
  String get sodium => 'સોડિયમ';

  @override
  String get copilotTitle => 'પોષણ કોપાઇલટ';

  @override
  String get copilotDisclaimer => 'તબીબી અથવા આહારવિજ્ઞાન સલાહ માટે અવેજી નથી.';

  @override
  String get copilotPlaceholder => 'આ ઉત્પાદ વિશે પૂછો…';

  @override
  String get weeklyReport => 'સાપ્તાહિક અહેવાલ';

  @override
  String get mealLog => 'ભોજન નોંધ';

  @override
  String get groceryCart => 'ખરીદારી ટોપલી';

  @override
  String get alternatives => 'આરોગ્યકર વિકલ્પો';

  @override
  String get budgetPickBadge => 'બજેટ પસંદ';

  @override
  String get thinCategoryMessage =>
      'આ શ્રેણીમાં વધુ સ્કોર સાથેના કોઈ વિકલ્પ મળ્યા નહીં.';

  @override
  String get notificationSettings => 'સૂચના સેટિંગ્સ';

  @override
  String get weeklyReportNotif => 'સાપ્તાહિક પોષણ અહેવાલ';

  @override
  String get allergenAlertNotif => 'એલર્જન ચેતવણીઓ';

  @override
  String get allergenAlertLockedNote =>
      'જટિલ સુરક્ષા ચેતવણીઓ — અક્ષમ કરી શકાશે નહીં';

  @override
  String get dataRightsTitle => 'તમારો ડેટા';

  @override
  String get exportData => 'મારો ડેટા નિકાસ કરો';

  @override
  String get deleteAccount => 'મારું ખાતું ભૂંસો';

  @override
  String get deleteConfirmTitle => 'ખાતું ભૂંસો?';

  @override
  String get deleteConfirmBody =>
      'આ તમારા તમામ સ્કૅન, ભોજન નોંધ અને પ્રોફાઇલ ડેટા કાયમ માટે ભૂંસી નાખશે. આ ઊલ્ટાવી શકાશે નહીં.';

  @override
  String get deleteConfirmButton => 'કાયમ માટે ભૂંસો';

  @override
  String get childModeWarning => 'બાળ સુરક્ષા મોડ સક્રિય';

  @override
  String get hypertensionWarning =>
      'ઉચ્ચ સોડિયમ — હાઈ બ્લડ પ્રેશર માટે સાવધાની';

  @override
  String get diabetesWarning => 'ઉચ્ચ ખાંડ — ડાયાબિટીસ માટે સાવધાની';

  @override
  String get searchHistoryTitle => 'શોધ ઇતિહાસ';

  @override
  String get searchHistoryHint =>
      'દા.ત. ઉચ્ચ સોડિયમ નાસ્તો, ઓછા સ્કોરના બિસ્કિટ';

  @override
  String get estimatedValue => 'અંદાજ';

  @override
  String get disclaimer =>
      'ફક્ત માહિતી હેતુ માટે. વ્યાવસાયિક પોષણ સલાહ માટે અવેજી નથી.';
}
