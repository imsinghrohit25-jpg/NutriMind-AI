// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Japanese (`ja`).
class AppLocalizationsJa extends AppLocalizations {
  AppLocalizationsJa([String locale = 'ja']) : super(locale);

  @override
  String get appName => 'NutriMind AI';

  @override
  String get scanProduct => '商品をスキャン';

  @override
  String get healthScore => '健康スコア';

  @override
  String get excellent => '優秀';

  @override
  String get good => '良い';

  @override
  String get fair => '普通';

  @override
  String get poor => '不良';

  @override
  String novaGroup(int group) {
    return 'NOVAグループ$group';
  }

  @override
  String get ingredients => '原材料';

  @override
  String get allergenWarning => 'アレルゲン警告';

  @override
  String allergenDeclared(String allergen) {
    return '$allergenを含む';
  }

  @override
  String allergenTrace(String allergen) {
    return '$allergenの痕跡が含まれる場合があります';
  }

  @override
  String get allergenFailSafe => '成分表を確実に読み取ることができませんでした。アレルゲンを手動でご確認ください。';

  @override
  String get nutritionFacts => '栄養成分表';

  @override
  String get per100g => '100gあたり';

  @override
  String perServing(num g) {
    final intl.NumberFormat gNumberFormat =
        intl.NumberFormat.decimalPattern(localeName);
    final String gString = gNumberFormat.format(g);

    return '1食分(${gString}g)あたり';
  }

  @override
  String get energyKcal => 'エネルギー';

  @override
  String get protein => 'たんぱく質';

  @override
  String get totalFat => '脂質';

  @override
  String get saturatedFat => '飽和脂肪酸';

  @override
  String get transFat => 'トランス脂肪酸';

  @override
  String get carbohydrates => '炭水化物';

  @override
  String get totalSugars => '糖質';

  @override
  String get addedSugars => '添加糖';

  @override
  String get dietaryFibre => '食物繊維';

  @override
  String get sodium => 'ナトリウム';

  @override
  String get copilotTitle => '栄養コパイロット';

  @override
  String get copilotDisclaimer => '医療または栄養士のアドバイスの代替ではありません。';

  @override
  String get copilotPlaceholder => 'この商品についてお聞きします…';

  @override
  String get weeklyReport => '週次レポート';

  @override
  String get mealLog => '食事ログ';

  @override
  String get groceryCart => '買い物かご';

  @override
  String get alternatives => 'より健康的な代替品';

  @override
  String get budgetPickBadge => 'コスパ優秀';

  @override
  String get thinCategoryMessage => 'このカテゴリでより高いスコアの代替品は見つかりませんでした。';

  @override
  String get notificationSettings => '通知設定';

  @override
  String get weeklyReportNotif => '週次栄養レポート';

  @override
  String get allergenAlertNotif => 'アレルゲンアラート';

  @override
  String get allergenAlertLockedNote => '重要な安全アラート — 無効にできません';

  @override
  String get dataRightsTitle => 'あなたのデータ';

  @override
  String get exportData => 'データをエクスポート';

  @override
  String get deleteAccount => 'アカウントを削除';

  @override
  String get deleteConfirmTitle => 'アカウントを削除しますか？';

  @override
  String get deleteConfirmBody =>
      'これにより、すべてのスキャン、食事ログ、プロフィールデータが完全に削除されます。この操作は元に戻せません。';

  @override
  String get deleteConfirmButton => '完全に削除';

  @override
  String get childModeWarning => '子どもの安全モード有効';

  @override
  String get hypertensionWarning => '塩分が多い — 高血圧の方は注意';

  @override
  String get diabetesWarning => '糖分が多い — 糖尿病の方は注意';

  @override
  String get searchHistoryTitle => '検索履歴';

  @override
  String get searchHistoryHint => '例：塩分の多いスナック、低スコアのビスケット';

  @override
  String get estimatedValue => '推定値';

  @override
  String get disclaimer => '情報提供のみを目的としています。専門的な栄養アドバイスの代替ではありません。';
}
