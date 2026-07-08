import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_ar.dart';
import 'app_localizations_bn.dart';
import 'app_localizations_de.dart';
import 'app_localizations_en.dart';
import 'app_localizations_es.dart';
import 'app_localizations_fr.dart';
import 'app_localizations_gu.dart';
import 'app_localizations_hi.dart';
import 'app_localizations_id.dart';
import 'app_localizations_ja.dart';
import 'app_localizations_kn.dart';
import 'app_localizations_ml.dart';
import 'app_localizations_mr.dart';
import 'app_localizations_pa.dart';
import 'app_localizations_pt.dart';
import 'app_localizations_ta.dart';
import 'app_localizations_te.dart';
import 'app_localizations_ur.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'l10n/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale)
      : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations)!;
  }

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates =
      <LocalizationsDelegate<dynamic>>[
    delegate,
    GlobalMaterialLocalizations.delegate,
    GlobalCupertinoLocalizations.delegate,
    GlobalWidgetsLocalizations.delegate,
  ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('ar'),
    Locale('bn'),
    Locale('de'),
    Locale('en'),
    Locale('es'),
    Locale('fr'),
    Locale('gu'),
    Locale('hi'),
    Locale('id'),
    Locale('ja'),
    Locale('kn'),
    Locale('ml'),
    Locale('mr'),
    Locale('pa'),
    Locale('pt'),
    Locale('ta'),
    Locale('te'),
    Locale('ur')
  ];

  /// Application name
  ///
  /// In en, this message translates to:
  /// **'NutriMind AI'**
  String get appName;

  /// Home screen CTA button
  ///
  /// In en, this message translates to:
  /// **'Scan a product'**
  String get scanProduct;

  /// No description provided for @healthScore.
  ///
  /// In en, this message translates to:
  /// **'Health Score'**
  String get healthScore;

  /// No description provided for @excellent.
  ///
  /// In en, this message translates to:
  /// **'Excellent'**
  String get excellent;

  /// No description provided for @good.
  ///
  /// In en, this message translates to:
  /// **'Good'**
  String get good;

  /// No description provided for @fair.
  ///
  /// In en, this message translates to:
  /// **'Fair'**
  String get fair;

  /// No description provided for @poor.
  ///
  /// In en, this message translates to:
  /// **'Poor'**
  String get poor;

  /// No description provided for @novaGroup.
  ///
  /// In en, this message translates to:
  /// **'NOVA Group {group}'**
  String novaGroup(int group);

  /// No description provided for @ingredients.
  ///
  /// In en, this message translates to:
  /// **'Ingredients'**
  String get ingredients;

  /// No description provided for @allergenWarning.
  ///
  /// In en, this message translates to:
  /// **'Allergen Warning'**
  String get allergenWarning;

  /// No description provided for @allergenDeclared.
  ///
  /// In en, this message translates to:
  /// **'Contains {allergen}'**
  String allergenDeclared(String allergen);

  /// No description provided for @allergenTrace.
  ///
  /// In en, this message translates to:
  /// **'May contain traces of {allergen}'**
  String allergenTrace(String allergen);

  /// No description provided for @allergenFailSafe.
  ///
  /// In en, this message translates to:
  /// **'We could not reliably read the ingredient list. Check for allergens manually.'**
  String get allergenFailSafe;

  /// No description provided for @nutritionFacts.
  ///
  /// In en, this message translates to:
  /// **'Nutrition Facts'**
  String get nutritionFacts;

  /// No description provided for @per100g.
  ///
  /// In en, this message translates to:
  /// **'per 100g'**
  String get per100g;

  /// No description provided for @perServing.
  ///
  /// In en, this message translates to:
  /// **'per serving ({g}g)'**
  String perServing(num g);

  /// No description provided for @energyKcal.
  ///
  /// In en, this message translates to:
  /// **'Energy'**
  String get energyKcal;

  /// No description provided for @protein.
  ///
  /// In en, this message translates to:
  /// **'Protein'**
  String get protein;

  /// No description provided for @totalFat.
  ///
  /// In en, this message translates to:
  /// **'Total Fat'**
  String get totalFat;

  /// No description provided for @saturatedFat.
  ///
  /// In en, this message translates to:
  /// **'Saturated Fat'**
  String get saturatedFat;

  /// No description provided for @transFat.
  ///
  /// In en, this message translates to:
  /// **'Trans Fat'**
  String get transFat;

  /// No description provided for @carbohydrates.
  ///
  /// In en, this message translates to:
  /// **'Carbohydrates'**
  String get carbohydrates;

  /// No description provided for @totalSugars.
  ///
  /// In en, this message translates to:
  /// **'Total Sugars'**
  String get totalSugars;

  /// No description provided for @addedSugars.
  ///
  /// In en, this message translates to:
  /// **'Added Sugars'**
  String get addedSugars;

  /// No description provided for @dietaryFibre.
  ///
  /// In en, this message translates to:
  /// **'Dietary Fibre'**
  String get dietaryFibre;

  /// No description provided for @sodium.
  ///
  /// In en, this message translates to:
  /// **'Sodium'**
  String get sodium;

  /// No description provided for @copilotTitle.
  ///
  /// In en, this message translates to:
  /// **'Nutrition Copilot'**
  String get copilotTitle;

  /// No description provided for @copilotDisclaimer.
  ///
  /// In en, this message translates to:
  /// **'Not a substitute for medical or dietetic advice.'**
  String get copilotDisclaimer;

  /// No description provided for @copilotPlaceholder.
  ///
  /// In en, this message translates to:
  /// **'Ask about this product…'**
  String get copilotPlaceholder;

  /// No description provided for @weeklyReport.
  ///
  /// In en, this message translates to:
  /// **'Weekly Report'**
  String get weeklyReport;

  /// No description provided for @mealLog.
  ///
  /// In en, this message translates to:
  /// **'Meal Log'**
  String get mealLog;

  /// No description provided for @groceryCart.
  ///
  /// In en, this message translates to:
  /// **'Grocery Cart'**
  String get groceryCart;

  /// No description provided for @alternatives.
  ///
  /// In en, this message translates to:
  /// **'Healthier Alternatives'**
  String get alternatives;

  /// No description provided for @budgetPickBadge.
  ///
  /// In en, this message translates to:
  /// **'Budget pick'**
  String get budgetPickBadge;

  /// No description provided for @thinCategoryMessage.
  ///
  /// In en, this message translates to:
  /// **'No better-scoring alternatives found in this category.'**
  String get thinCategoryMessage;

  /// No description provided for @notificationSettings.
  ///
  /// In en, this message translates to:
  /// **'Notification Settings'**
  String get notificationSettings;

  /// No description provided for @weeklyReportNotif.
  ///
  /// In en, this message translates to:
  /// **'Weekly nutrition report'**
  String get weeklyReportNotif;

  /// No description provided for @allergenAlertNotif.
  ///
  /// In en, this message translates to:
  /// **'Allergen alerts'**
  String get allergenAlertNotif;

  /// No description provided for @allergenAlertLockedNote.
  ///
  /// In en, this message translates to:
  /// **'Critical safety alerts — cannot be disabled'**
  String get allergenAlertLockedNote;

  /// No description provided for @dataRightsTitle.
  ///
  /// In en, this message translates to:
  /// **'Your Data'**
  String get dataRightsTitle;

  /// No description provided for @exportData.
  ///
  /// In en, this message translates to:
  /// **'Export my data'**
  String get exportData;

  /// No description provided for @deleteAccount.
  ///
  /// In en, this message translates to:
  /// **'Delete my account'**
  String get deleteAccount;

  /// No description provided for @deleteConfirmTitle.
  ///
  /// In en, this message translates to:
  /// **'Delete account?'**
  String get deleteConfirmTitle;

  /// No description provided for @deleteConfirmBody.
  ///
  /// In en, this message translates to:
  /// **'This will permanently erase all your scans, meal logs, and profile data. This cannot be undone.'**
  String get deleteConfirmBody;

  /// No description provided for @deleteConfirmButton.
  ///
  /// In en, this message translates to:
  /// **'Delete permanently'**
  String get deleteConfirmButton;

  /// No description provided for @childModeWarning.
  ///
  /// In en, this message translates to:
  /// **'Child Safety Mode Active'**
  String get childModeWarning;

  /// No description provided for @hypertensionWarning.
  ///
  /// In en, this message translates to:
  /// **'High sodium — caution for hypertension'**
  String get hypertensionWarning;

  /// No description provided for @diabetesWarning.
  ///
  /// In en, this message translates to:
  /// **'High sugar — caution for diabetes'**
  String get diabetesWarning;

  /// No description provided for @searchHistoryTitle.
  ///
  /// In en, this message translates to:
  /// **'Search History'**
  String get searchHistoryTitle;

  /// No description provided for @searchHistoryHint.
  ///
  /// In en, this message translates to:
  /// **'e.g. high sodium snacks, low score biscuits'**
  String get searchHistoryHint;

  /// No description provided for @estimatedValue.
  ///
  /// In en, this message translates to:
  /// **'Estimated'**
  String get estimatedValue;

  /// No description provided for @disclaimer.
  ///
  /// In en, this message translates to:
  /// **'For informational purposes only. Not a substitute for professional nutritional advice.'**
  String get disclaimer;
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) => <String>[
        'ar',
        'bn',
        'de',
        'en',
        'es',
        'fr',
        'gu',
        'hi',
        'id',
        'ja',
        'kn',
        'ml',
        'mr',
        'pa',
        'pt',
        'ta',
        'te',
        'ur'
      ].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'ar':
      return AppLocalizationsAr();
    case 'bn':
      return AppLocalizationsBn();
    case 'de':
      return AppLocalizationsDe();
    case 'en':
      return AppLocalizationsEn();
    case 'es':
      return AppLocalizationsEs();
    case 'fr':
      return AppLocalizationsFr();
    case 'gu':
      return AppLocalizationsGu();
    case 'hi':
      return AppLocalizationsHi();
    case 'id':
      return AppLocalizationsId();
    case 'ja':
      return AppLocalizationsJa();
    case 'kn':
      return AppLocalizationsKn();
    case 'ml':
      return AppLocalizationsMl();
    case 'mr':
      return AppLocalizationsMr();
    case 'pa':
      return AppLocalizationsPa();
    case 'pt':
      return AppLocalizationsPt();
    case 'ta':
      return AppLocalizationsTa();
    case 'te':
      return AppLocalizationsTe();
    case 'ur':
      return AppLocalizationsUr();
  }

  throw FlutterError(
      'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
      'an issue with the localizations generation tool. Please file an issue '
      'on GitHub with a reproducible sample app and the gen-l10n configuration '
      'that was used.');
}
