// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Marathi (`mr`).
class AppLocalizationsMr extends AppLocalizations {
  AppLocalizationsMr([String locale = 'mr']) : super(locale);

  @override
  String get appName => 'NutriMind AI';

  @override
  String get scanProduct => 'उत्पाद स्कॅन करा';

  @override
  String get healthScore => 'आरोग्य गुण';

  @override
  String get excellent => 'उत्कृष्ट';

  @override
  String get good => 'चांगले';

  @override
  String get fair => 'ठीक';

  @override
  String get poor => 'वाईट';

  @override
  String novaGroup(int group) {
    return 'NOVA गट $group';
  }

  @override
  String get ingredients => 'घटक';

  @override
  String get allergenWarning => 'ॲलर्जन इशारा';

  @override
  String allergenDeclared(String allergen) {
    return 'यात $allergen आहे';
  }

  @override
  String allergenTrace(String allergen) {
    return 'यात $allergen चे अंश असू शकतात';
  }

  @override
  String get allergenFailSafe =>
      'आम्ही घटक यादी विश्वासार्हपणे वाचू शकलो नाही। ॲलर्जनसाठी स्वतः तपासा.';

  @override
  String get nutritionFacts => 'पोषण तथ्ये';

  @override
  String get per100g => 'प्रति 100 ग्रॅम';

  @override
  String perServing(num g) {
    final intl.NumberFormat gNumberFormat =
        intl.NumberFormat.decimalPattern(localeName);
    final String gString = gNumberFormat.format(g);

    return 'प्रति सर्व्हिंग ($gStringग्रॅम)';
  }

  @override
  String get energyKcal => 'ऊर्जा';

  @override
  String get protein => 'प्रथिने';

  @override
  String get totalFat => 'एकूण चरबी';

  @override
  String get saturatedFat => 'संतृप्त चरबी';

  @override
  String get transFat => 'ट्रान्स चरबी';

  @override
  String get carbohydrates => 'कर्बोदके';

  @override
  String get totalSugars => 'एकूण साखर';

  @override
  String get addedSugars => 'जोडलेली साखर';

  @override
  String get dietaryFibre => 'आहारातील तंतू';

  @override
  String get sodium => 'सोडियम';

  @override
  String get copilotTitle => 'पोषण सहाय्यक';

  @override
  String get copilotDisclaimer =>
      'हे वैद्यकीय किंवा आहारतज्ज्ञांच्या सल्ल्याचा पर्याय नाही.';

  @override
  String get copilotPlaceholder => 'या उत्पादाबद्दल विचारा…';

  @override
  String get weeklyReport => 'साप्ताहिक अहवाल';

  @override
  String get mealLog => 'जेवण नोंद';

  @override
  String get groceryCart => 'किराणा टोपली';

  @override
  String get alternatives => 'अधिक आरोग्यदायी पर्याय';

  @override
  String get budgetPickBadge => 'परवडणारा पर्याय';

  @override
  String get thinCategoryMessage =>
      'या वर्गात कोणताही चांगला स्कोर असलेला पर्याय सापडला नाही.';

  @override
  String get notificationSettings => 'सूचना सेटिंग्ज';

  @override
  String get weeklyReportNotif => 'साप्ताहिक पोषण अहवाल';

  @override
  String get allergenAlertNotif => 'ॲलर्जन सतर्कता';

  @override
  String get allergenAlertLockedNote =>
      'महत्त्वाच्या सुरक्षा सतर्कता — अक्षम करता येत नाही';

  @override
  String get dataRightsTitle => 'तुमचा डेटा';

  @override
  String get exportData => 'माझा डेटा निर्यात करा';

  @override
  String get deleteAccount => 'माझे खाते हटवा';

  @override
  String get deleteConfirmTitle => 'खाते हटवायचे?';

  @override
  String get deleteConfirmBody =>
      'यामुळे तुमचे सर्व स्कॅन, जेवण नोंदी आणि प्रोफाइल डेटा कायमचे हटविले जाईल. हे पूर्ववत केले जाऊ शकत नाही.';

  @override
  String get deleteConfirmButton => 'कायमचे हटवा';

  @override
  String get childModeWarning => 'बाल सुरक्षा मोड सक्रिय';

  @override
  String get hypertensionWarning => 'जास्त सोडियम — उच्च रक्तदाबासाठी सावधगिरी';

  @override
  String get diabetesWarning => 'जास्त साखर — मधुमेहासाठी सावधगिरी';

  @override
  String get searchHistoryTitle => 'इतिहास शोधा';

  @override
  String get searchHistoryHint =>
      'उदा. जास्त सोडियम स्नॅक्स, कमी स्कोर बिस्किटे';

  @override
  String get estimatedValue => 'अंदाजे';

  @override
  String get disclaimer =>
      'केवळ माहितीसाठी. व्यावसायिक पोषण सल्ल्याचा पर्याय नाही.';
}
