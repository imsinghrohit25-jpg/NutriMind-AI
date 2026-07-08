// Numeral system rendering — converts Western Arabic digits to locale-specific numerals.
// Feature-flagged behind global.p2.numeral_rendering.

/// Supported numeral script systems.
enum NumeralSystem {
  /// 0 1 2 3 4 5 6 7 8 9  (default — all Latin-script locales)
  western,
  /// ٠ ١ ٢ ٣ ٤ ٥ ٦ ٧ ٨ ٩  (Arabic-Indic — ar, fa, ur)
  arabicIndic,
  /// ० १ २ ३ ४ ५ ६ ७ ८ ९  (Devanagari — hi, mr, ne, kok, sa)
  devanagari,
  /// ০ ১ ২ ৩ ৪ ৫ ৬ ৭ ৮ ৯  (Bengali — bn, as)
  bengali,
  /// ૦ ૧ ૨ ૩ ૪ ૫ ૬ ૭ ૮ ૯  (Gujarati — gu)
  gujarati,
  /// ੦ ੧ ੨ ੩ ੪ ੫ ੬ ੭ ੮ ੯  (Gurmukhi — pa)
  gurmukhi,
}

const _western      = ['0','1','2','3','4','5','6','7','8','9'];
const _arabicIndic  = ['٠','١','٢','٣','٤','٥','٦','٧','٨','٩'];
const _devanagari   = ['०','१','२','३','४','५','६','७','८','९'];
const _bengali      = ['০','১','২','৩','৪','৫','৬','৭','৮','৯'];
const _gujarati     = ['૦','૧','૨','૩','૪','૫','૬','૭','૮','૯'];
const _gurmukhi     = ['੦','੧','੨','੩','੪','੫','੬','੭','੮','੯'];

/// Converts a numeric string (digits only) to the target numeral system.
/// Non-digit characters (decimal point, minus, comma) are preserved as-is.
String convertNumerals(String input, NumeralSystem system) {
  if (system == NumeralSystem.western) return input;
  final digits = _digitsFor(system);
  final buf = StringBuffer();
  for (var i = 0; i < input.length; i++) {
    final ch = input[i];
    final digit = _western.indexOf(ch);
    buf.write(digit >= 0 ? digits[digit] : ch);
  }
  return buf.toString();
}

/// Formats an integer in the target numeral system (no decimal).
String formatInt(int value, NumeralSystem system) =>
    convertNumerals(value.toString(), system);

/// Formats a double to [fractionDigits] places in the target numeral system.
String formatDouble(double value, NumeralSystem system, {int fractionDigits = 1}) =>
    convertNumerals(value.toStringAsFixed(fractionDigits), system);

List<String> _digitsFor(NumeralSystem system) => switch (system) {
  NumeralSystem.western     => _western,
  NumeralSystem.arabicIndic => _arabicIndic,
  NumeralSystem.devanagari  => _devanagari,
  NumeralSystem.bengali     => _bengali,
  NumeralSystem.gujarati    => _gujarati,
  NumeralSystem.gurmukhi    => _gurmukhi,
};

/// Map from BCP-47 language subtag to the preferred numeral system.
/// When numeral_rendering flag is OFF, always return NumeralSystem.western.
const Map<String, NumeralSystem> kLocaleNumeralSystem = {
  'ar': NumeralSystem.arabicIndic,
  'ur': NumeralSystem.arabicIndic,
  'fa': NumeralSystem.arabicIndic,
  'hi': NumeralSystem.devanagari,
  'mr': NumeralSystem.devanagari,
  'ne': NumeralSystem.devanagari,
  'kok': NumeralSystem.devanagari,
  'bn': NumeralSystem.bengali,
  'as': NumeralSystem.bengali,
  'gu': NumeralSystem.gujarati,
  'pa': NumeralSystem.gurmukhi,
  // Tamil, Telugu, Kannada, Malayalam primarily use Western digits
  // on modern labels — keep western for these.
};

/// Resolve numeral system for a given language code.
/// [languageCode]: BCP-47 language subtag (e.g. 'hi', 'ar').
/// [enabled]: whether global.p2.numeral_rendering flag is ON.
NumeralSystem resolveNumeralSystem(String languageCode, {required bool enabled}) {
  if (!enabled) return NumeralSystem.western;
  return kLocaleNumeralSystem[languageCode.toLowerCase()] ?? NumeralSystem.western;
}
