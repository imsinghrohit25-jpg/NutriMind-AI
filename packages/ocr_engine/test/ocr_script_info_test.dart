import 'package:flutter_test/flutter_test.dart';
import 'package:nutrimind_ocr_engine/nutrimind_ocr_engine.dart';

void main() {
  group('isOnDeviceSupported', () {
    test('is true for scripts ML Kit handles natively', () {
      expect(isOnDeviceSupported(OcrScript.latin), true);
      expect(isOnDeviceSupported(OcrScript.devanagari), true);
      expect(isOnDeviceSupported(OcrScript.cjk), true);
      expect(isOnDeviceSupported(OcrScript.korean), true);
    });

    test('is false for scripts needing cloud OCR fallback', () {
      expect(isOnDeviceSupported(OcrScript.arabic), false);
      expect(isOnDeviceSupported(OcrScript.tamil), false);
      expect(isOnDeviceSupported(OcrScript.telugu), false);
      expect(isOnDeviceSupported(OcrScript.other), false);
    });
  });

  group('ocrScriptFromApi', () {
    test('parses known script names', () {
      expect(ocrScriptFromApi('devanagari'), OcrScript.devanagari);
      expect(ocrScriptFromApi('arabic'), OcrScript.arabic);
    });

    test('falls back to other for unrecognised/null values', () {
      expect(ocrScriptFromApi('klingon'), OcrScript.other);
      expect(ocrScriptFromApi(null), OcrScript.other);
    });
  });

  group('labelFormatDisplayName / labelFormatFromApi', () {
    test('round-trips generic', () {
      expect(labelFormatFromApi('generic'), LabelFormat.generic);
      expect(labelFormatDisplayName(LabelFormat.generic), contains('Generic'));
    });

    test('round-trips us_nfp', () {
      expect(labelFormatFromApi('us_nfp'), LabelFormat.usNfp);
      expect(labelFormatDisplayName(LabelFormat.usNfp), contains('US Nutrition Facts'));
    });

    test('falls back to generic for unrecognised/null values', () {
      expect(labelFormatFromApi('eu_pnns'), LabelFormat.generic);
      expect(labelFormatFromApi(null), LabelFormat.generic);
    });
  });
}
