import 'dart:io';
import 'package:google_mlkit_text_recognition/google_mlkit_text_recognition.dart';

// On-device OCR via ML Kit — works fully offline.
// Extracts nutrition label text from images for Phase 5 label parsing.
// Strategy: on-device OCR first (< 2s target); server parse if confidence low.

class OcrMlKit {
  OcrMlKit()
      : _recognizer = TextRecognizer(script: TextRecognitionScript.latin);

  final TextRecognizer _recognizer;

  Future<OcrResult> recognizeFile(String filePath) async {
    final inputImage = InputImage.fromFile(File(filePath));
    return _recognize(inputImage);
  }

  Future<OcrResult> _recognize(InputImage image) async {
    final recognized = await _recognizer.processImage(image);

    // Flatten blocks → lines preserving reading order
    final lines = recognized.blocks
        .expand((b) => b.lines)
        .map((l) => l.text.trim())
        .where((t) => t.isNotEmpty)
        .toList();

    final fullText = lines.join('\n');

    // Heuristic confidence: if we detect known nutrition keywords, confidence is high
    final nutritionKeywords = ['energy', 'protein', 'fat', 'carbohydrate', 'sodium',
                               'calories', 'serving', 'per 100', 'kcal', 'kj'];
    final lower = fullText.toLowerCase();
    final matchedKeywords = nutritionKeywords.where(lower.contains).length;
    final confidence = (matchedKeywords / nutritionKeywords.length).clamp(0.0, 1.0);

    return OcrResult(
      rawText: fullText,
      lines: lines,
      confidence: confidence,
      isNutritionLabel: confidence >= 0.3,
    );
  }

  Future<void> close() => _recognizer.close();
}

class OcrResult {
  const OcrResult({
    required this.rawText,
    required this.lines,
    required this.confidence,
    required this.isNutritionLabel,
  });

  final String rawText;
  final List<String> lines;
  final double confidence;

  // True when we detected enough nutrition-related keywords.
  // Low confidence (< 0.3) → show "confirm details" UI before sending to API.
  final bool isNutritionLabel;

  bool get needsUserConfirmation => confidence < 0.5;
}
