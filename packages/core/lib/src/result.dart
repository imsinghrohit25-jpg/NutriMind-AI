// Result type — avoids try/catch at every call site.
// Every fallible operation returns Result<T, E extends NutriMindError>.

sealed class Result<T, E extends NutriMindError> {
  const Result();

  bool get isOk    => this is Ok<T, E>;
  bool get isError => this is Err<T, E>;

  T get value {
    final self = this;
    if (self is Ok<T, E>) return self._value;
    throw StateError('Called value on Err: ${(self as Err<T, E>).error}');
  }

  E get error {
    final self = this;
    if (self is Err<T, E>) return self._error;
    throw StateError('Called error on Ok');
  }

  R fold<R>({
    required R Function(T value) ok,
    required R Function(E error) err,
  }) {
    final self = this;
    return switch (self) {
      Ok<T, E>()  => ok(self._value),
      Err<T, E>() => err(self._error),
    };
  }

  Result<U, E> map<U>(U Function(T) f) {
    final self = this;
    return switch (self) {
      Ok<T, E>()  => Ok(f(self._value)),
      Err<T, E>() => Err(self._error),
    };
  }

  Result<U, E> flatMap<U>(Result<U, E> Function(T) f) {
    final self = this;
    return switch (self) {
      Ok<T, E>()  => f(self._value),
      Err<T, E>() => Err(self._error),
    };
  }

  T getOrElse(T Function(E) fallback) {
    final self = this;
    return switch (self) {
      Ok<T, E>()  => self._value,
      Err<T, E>() => fallback(self._error),
    };
  }
}

final class Ok<T, E extends NutriMindError> extends Result<T, E> {
  const Ok(this._value);
  final T _value;
  @override String toString() => 'Ok($_value)';
}

final class Err<T, E extends NutriMindError> extends Result<T, E> {
  const Err(this._error);
  final E _error;
  @override String toString() => 'Err($_error)';
}

// Re-export base error type here so callers don't need two imports
export 'errors.dart';
