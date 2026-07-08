// NutriMind error hierarchy.

sealed class NutriMindError implements Exception {
  const NutriMindError(this.message, {this.cause});
  final String  message;
  final Object? cause;

  @override String toString() => '$runtimeType: $message${cause != null ? ' (caused by: $cause)' : ''}';
}

/// Transient network/API errors — safe to retry.
final class NetworkError extends NutriMindError {
  const NetworkError(super.message, {super.cause, this.statusCode});
  final int? statusCode;
}

/// Data not found in any source.
final class NotFoundError extends NutriMindError {
  const NotFoundError(super.message, {super.cause, this.resourceId});
  final String? resourceId;
}

/// Security / auth errors.
final class AuthError extends NutriMindError {
  const AuthError(super.message, {super.cause});
}

/// Validation errors — caller supplied bad data.
final class ValidationError extends NutriMindError {
  const ValidationError(super.message, {super.cause, this.field});
  final String? field;
}

/// Integration not yet available (e.g. pending partner approval).
final class IntegrationUnavailableError extends NutriMindError {
  const IntegrationUnavailableError(super.message, {super.cause, required this.integrationName});
  final String integrationName;
}

/// An allergen safety gate was triggered.
final class AllergenSafetyError extends NutriMindError {
  const AllergenSafetyError(super.message, {super.cause, required this.allergens});
  final List<String> allergens;
}

/// Internal / unexpected error.
final class InternalError extends NutriMindError {
  const InternalError(super.message, {super.cause});
}
