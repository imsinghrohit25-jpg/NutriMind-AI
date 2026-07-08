// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Spanish Castilian (`es`).
class AppLocalizationsEs extends AppLocalizations {
  AppLocalizationsEs([String locale = 'es']) : super(locale);

  @override
  String get appName => 'NutriMind IA';

  @override
  String get scanProduct => 'Escanear un producto';

  @override
  String get healthScore => 'Puntuación de Salud';

  @override
  String get excellent => 'Excelente';

  @override
  String get good => 'Bueno';

  @override
  String get fair => 'Regular';

  @override
  String get poor => 'Malo';

  @override
  String novaGroup(int group) {
    return 'Grupo NOVA $group';
  }

  @override
  String get ingredients => 'Ingredientes';

  @override
  String get allergenWarning => 'Advertencia de Alérgeno';

  @override
  String allergenDeclared(String allergen) {
    return 'Contiene $allergen';
  }

  @override
  String allergenTrace(String allergen) {
    return 'Puede contener trazas de $allergen';
  }

  @override
  String get allergenFailSafe =>
      'No pudimos leer la lista de ingredientes con fiabilidad. Verifique los alérgenos manualmente.';

  @override
  String get nutritionFacts => 'Información Nutricional';

  @override
  String get per100g => 'por 100g';

  @override
  String perServing(num g) {
    final intl.NumberFormat gNumberFormat =
        intl.NumberFormat.decimalPattern(localeName);
    final String gString = gNumberFormat.format(g);

    return 'por porción (${gString}g)';
  }

  @override
  String get energyKcal => 'Energía';

  @override
  String get protein => 'Proteínas';

  @override
  String get totalFat => 'Grasas Totales';

  @override
  String get saturatedFat => 'Grasas Saturadas';

  @override
  String get transFat => 'Grasas Trans';

  @override
  String get carbohydrates => 'Carbohidratos';

  @override
  String get totalSugars => 'Azúcares Totales';

  @override
  String get addedSugars => 'Azúcares Añadidos';

  @override
  String get dietaryFibre => 'Fibra Dietética';

  @override
  String get sodium => 'Sodio';

  @override
  String get copilotTitle => 'Copiloto de Nutrición';

  @override
  String get copilotDisclaimer => 'No sustituye el consejo médico o dietético.';

  @override
  String get copilotPlaceholder => 'Pregunta sobre este producto…';

  @override
  String get weeklyReport => 'Informe Semanal';

  @override
  String get mealLog => 'Registro de Comidas';

  @override
  String get groceryCart => 'Carrito de Compras';

  @override
  String get alternatives => 'Alternativas más Saludables';

  @override
  String get budgetPickBadge => 'Opción económica';

  @override
  String get thinCategoryMessage =>
      'No se encontraron alternativas con mejor puntuación en esta categoría.';

  @override
  String get notificationSettings => 'Configuración de Notificaciones';

  @override
  String get weeklyReportNotif => 'Informe nutricional semanal';

  @override
  String get allergenAlertNotif => 'Alertas de alérgenos';

  @override
  String get allergenAlertLockedNote =>
      'Alertas de seguridad críticas — no se pueden desactivar';

  @override
  String get dataRightsTitle => 'Tus Datos';

  @override
  String get exportData => 'Exportar mis datos';

  @override
  String get deleteAccount => 'Eliminar mi cuenta';

  @override
  String get deleteConfirmTitle => '¿Eliminar cuenta?';

  @override
  String get deleteConfirmBody =>
      'Esto borrará permanentemente todos tus escaneos, registros de comidas y datos de perfil. Esta acción no se puede deshacer.';

  @override
  String get deleteConfirmButton => 'Eliminar permanentemente';

  @override
  String get childModeWarning => 'Modo Seguridad Infantil Activo';

  @override
  String get hypertensionWarning =>
      'Alto en sodio — precaución para hipertensión';

  @override
  String get diabetesWarning => 'Alto en azúcar — precaución para diabetes';

  @override
  String get searchHistoryTitle => 'Historial de Búsqueda';

  @override
  String get searchHistoryHint =>
      'ej. aperitivos con alto sodio, galletas con baja puntuación';

  @override
  String get estimatedValue => 'Estimado';

  @override
  String get disclaimer =>
      'Solo con fines informativos. No sustituye el consejo nutricional profesional.';
}
