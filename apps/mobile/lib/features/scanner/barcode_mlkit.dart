import 'dart:io';
import 'dart:typed_data';
import 'package:google_mlkit_barcode_scanning/google_mlkit_barcode_scanning.dart';

// On-device barcode scanner via ML Kit — works fully offline.
// Supports all common barcode formats; EAN-13/EAN-8 prioritised for Indian retail.

class BarcodeMlKit {
  BarcodeMlKit()
      : _scanner = BarcodeScanner(
          formats: const [
            BarcodeFormat.ean13,
            BarcodeFormat.ean8,
            BarcodeFormat.upca,
            BarcodeFormat.upce,
            BarcodeFormat.qrCode,
            BarcodeFormat.code128,
            BarcodeFormat.code39,
          ],
        );

  final BarcodeScanner _scanner;

  // Scan from a file path (captured image).
  Future<List<ScannedBarcode>> scanFile(String filePath) async {
    final inputImage = InputImage.fromFile(File(filePath));
    return _scan(inputImage);
  }

  // Scan from raw bytes (camera preview frame).
  Future<List<ScannedBarcode>> scanBytes(
    Uint8List bytes,
    InputImageMetadata metadata,
  ) async {
    final inputImage = InputImage.fromBytes(bytes: bytes, metadata: metadata);
    return _scan(inputImage);
  }

  Future<List<ScannedBarcode>> _scan(InputImage image) async {
    final barcodes = await _scanner.processImage(image);
    return barcodes.map((b) {
      final raw = b.displayValue ?? b.rawValue ?? '';
      return ScannedBarcode(
        value: raw,
        format: _mapFormat(b.format),
        confidence: 1.0,  // ML Kit doesn't expose confidence; treat as certain
      );
    }).toList();
  }

  String _mapFormat(BarcodeFormat f) => switch (f) {
    BarcodeFormat.ean13  => 'ean13',
    BarcodeFormat.ean8   => 'ean8',
    BarcodeFormat.upca   => 'upc_a',
    BarcodeFormat.upce   => 'upc_e',
    BarcodeFormat.qrCode => 'qr',
    _                    => 'other',
  };

  Future<void> close() => _scanner.close();
}

class ScannedBarcode {
  const ScannedBarcode({
    required this.value,
    required this.format,
    required this.confidence,
  });
  final String value;
  final String format;
  final double confidence;

  bool get isProductBarcode =>
      format == 'ean13' || format == 'ean8' || format == 'upc_a' || format == 'upc_e';
}
