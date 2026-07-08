// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Portuguese (`pt`).
class AppLocalizationsPt extends AppLocalizations {
  AppLocalizationsPt([String locale = 'pt']) : super(locale);

  @override
  String get appName => 'NutriMind IA';

  @override
  String get scanProduct => 'Escanear um produto';

  @override
  String get healthScore => 'Pontuação de Saúde';

  @override
  String get excellent => 'Excelente';

  @override
  String get good => 'Bom';

  @override
  String get fair => 'Regular';

  @override
  String get poor => 'Ruim';

  @override
  String novaGroup(int group) {
    return 'Grupo NOVA $group';
  }

  @override
  String get ingredients => 'Ingredientes';

  @override
  String get allergenWarning => 'Aviso de Alérgeno';

  @override
  String allergenDeclared(String allergen) {
    return 'Contém $allergen';
  }

  @override
  String allergenTrace(String allergen) {
    return 'Pode conter traços de $allergen';
  }

  @override
  String get allergenFailSafe =>
      'Não conseguimos ler a lista de ingredientes de forma confiável. Verifique os alérgenos manualmente.';

  @override
  String get nutritionFacts => 'Informações Nutricionais';

  @override
  String get per100g => 'por 100g';

  @override
  String perServing(num g) {
    final intl.NumberFormat gNumberFormat =
        intl.NumberFormat.decimalPattern(localeName);
    final String gString = gNumberFormat.format(g);

    return 'por porção (${gString}g)';
  }

  @override
  String get energyKcal => 'Energia';

  @override
  String get protein => 'Proteínas';

  @override
  String get totalFat => 'Gorduras Totais';

  @override
  String get saturatedFat => 'Gorduras Saturadas';

  @override
  String get transFat => 'Gorduras Trans';

  @override
  String get carbohydrates => 'Carboidratos';

  @override
  String get totalSugars => 'Açúcares Totais';

  @override
  String get addedSugars => 'Açúcares Adicionados';

  @override
  String get dietaryFibre => 'Fibra Alimentar';

  @override
  String get sodium => 'Sódio';

  @override
  String get copilotTitle => 'Copiloto de Nutrição';

  @override
  String get copilotDisclaimer =>
      'Não substitui aconselhamento médico ou dietético.';

  @override
  String get copilotPlaceholder => 'Pergunte sobre este produto…';

  @override
  String get weeklyReport => 'Relatório Semanal';

  @override
  String get mealLog => 'Registro de Refeições';

  @override
  String get groceryCart => 'Carrinho de Compras';

  @override
  String get alternatives => 'Alternativas Mais Saudáveis';

  @override
  String get budgetPickBadge => 'Escolha econômica';

  @override
  String get thinCategoryMessage =>
      'Nenhuma alternativa com pontuação melhor encontrada nesta categoria.';

  @override
  String get notificationSettings => 'Configurações de Notificações';

  @override
  String get weeklyReportNotif => 'Relatório nutricional semanal';

  @override
  String get allergenAlertNotif => 'Alertas de alérgenos';

  @override
  String get allergenAlertLockedNote =>
      'Alertas de segurança críticos — não podem ser desativados';

  @override
  String get dataRightsTitle => 'Seus Dados';

  @override
  String get exportData => 'Exportar meus dados';

  @override
  String get deleteAccount => 'Excluir minha conta';

  @override
  String get deleteConfirmTitle => 'Excluir conta?';

  @override
  String get deleteConfirmBody =>
      'Isso apagará permanentemente todos os seus scans, registros de refeições e dados de perfil. Esta ação não pode ser desfeita.';

  @override
  String get deleteConfirmButton => 'Excluir permanentemente';

  @override
  String get childModeWarning => 'Modo Segurança Infantil Ativo';

  @override
  String get hypertensionWarning => 'Alto em sódio — cuidado para hipertensão';

  @override
  String get diabetesWarning => 'Alto em açúcar — cuidado para diabetes';

  @override
  String get searchHistoryTitle => 'Histórico de Pesquisa';

  @override
  String get searchHistoryHint =>
      'ex. snacks com alto sódio, biscoitos com baixa pontuação';

  @override
  String get estimatedValue => 'Estimado';

  @override
  String get disclaimer =>
      'Apenas para fins informativos. Não substitui aconselhamento nutricional profissional.';
}
