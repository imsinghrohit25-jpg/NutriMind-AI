// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Hindi (`hi`).
class AppLocalizationsHi extends AppLocalizations {
  AppLocalizationsHi([String locale = 'hi']) : super(locale);

  @override
  String get appName => 'NutriMind AI';

  @override
  String get scanProduct => 'उत्पाद स्कैन करें';

  @override
  String get healthScore => 'स्वास्थ्य स्कोर';

  @override
  String get excellent => 'उत्कृष्ट';

  @override
  String get good => 'अच्छा';

  @override
  String get fair => 'ठीक';

  @override
  String get poor => 'खराब';

  @override
  String novaGroup(int group) {
    return 'NOVA समूह $group';
  }

  @override
  String get ingredients => 'सामग्री';

  @override
  String get allergenWarning => 'एलर्जन चेतावनी';

  @override
  String allergenDeclared(String allergen) {
    return 'इसमें $allergen है';
  }

  @override
  String allergenTrace(String allergen) {
    return 'इसमें $allergen के अंश हो सकते हैं';
  }

  @override
  String get allergenFailSafe =>
      'हम सामग्री सूची को विश्वसनीय रूप से नहीं पढ़ सके। एलर्जन की मैन्युअल जांच करें।';

  @override
  String get nutritionFacts => 'पोषण तथ्य';

  @override
  String get per100g => 'प्रति 100 ग्राम';

  @override
  String perServing(num g) {
    final intl.NumberFormat gNumberFormat =
        intl.NumberFormat.decimalPattern(localeName);
    final String gString = gNumberFormat.format(g);

    return 'प्रति सर्विंग ($gStringग्राम)';
  }

  @override
  String get energyKcal => 'ऊर्जा';

  @override
  String get protein => 'प्रोटीन';

  @override
  String get totalFat => 'कुल वसा';

  @override
  String get saturatedFat => 'संतृप्त वसा';

  @override
  String get transFat => 'ट्रांस वसा';

  @override
  String get carbohydrates => 'कार्बोहाइड्रेट';

  @override
  String get totalSugars => 'कुल शर्करा';

  @override
  String get addedSugars => 'मिलाई गई शर्करा';

  @override
  String get dietaryFibre => 'आहार फाइबर';

  @override
  String get sodium => 'सोडियम';

  @override
  String get copilotTitle => 'पोषण सहायक';

  @override
  String get copilotDisclaimer =>
      'यह चिकित्सीय या आहार विशेषज्ञ की सलाह का विकल्प नहीं है।';

  @override
  String get copilotPlaceholder => 'इस उत्पाद के बारे में पूछें…';

  @override
  String get weeklyReport => 'साप्ताहिक रिपोर्ट';

  @override
  String get mealLog => 'भोजन लॉग';

  @override
  String get groceryCart => 'किराना टोकरी';

  @override
  String get alternatives => 'स्वास्थ्यप्रद विकल्प';

  @override
  String get budgetPickBadge => 'किफ़ायती विकल्प';

  @override
  String get thinCategoryMessage =>
      'इस श्रेणी में कोई बेहतर स्कोर वाला विकल्प नहीं मिला।';

  @override
  String get notificationSettings => 'सूचना सेटिंग';

  @override
  String get weeklyReportNotif => 'साप्ताहिक पोषण रिपोर्ट';

  @override
  String get allergenAlertNotif => 'एलर्जन अलर्ट';

  @override
  String get allergenAlertLockedNote =>
      'महत्वपूर्ण सुरक्षा अलर्ट — अक्षम नहीं किए जा सकते';

  @override
  String get dataRightsTitle => 'आपका डेटा';

  @override
  String get exportData => 'मेरा डेटा निर्यात करें';

  @override
  String get deleteAccount => 'मेरा खाता हटाएं';

  @override
  String get deleteConfirmTitle => 'खाता हटाएं?';

  @override
  String get deleteConfirmBody =>
      'यह आपके सभी स्कैन, भोजन लॉग और प्रोफ़ाइल डेटा को स्थायी रूप से मिटा देगा। यह क्रिया पूर्ववत नहीं की जा सकती।';

  @override
  String get deleteConfirmButton => 'स्थायी रूप से हटाएं';

  @override
  String get childModeWarning => 'बाल सुरक्षा मोड सक्रिय';

  @override
  String get hypertensionWarning => 'अधिक सोडियम — उच्च रक्तचाप के लिए सावधानी';

  @override
  String get diabetesWarning => 'अधिक शर्करा — मधुमेह के लिए सावधानी';

  @override
  String get searchHistoryTitle => 'इतिहास खोजें';

  @override
  String get searchHistoryHint =>
      'जैसे: अधिक सोडियम वाले स्नैक्स, कम स्कोर वाले बिस्किट';

  @override
  String get estimatedValue => 'अनुमानित';

  @override
  String get disclaimer =>
      'केवल सूचनात्मक उद्देश्यों के लिए। पेशेवर पोषण सलाह का विकल्प नहीं।';
}
