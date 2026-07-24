// Lab report upload screen — captures image, runs on-device OCR (ML Kit), uploads.

import '../../core/design_system/components/app_loader.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_mlkit_text_recognition/google_mlkit_text_recognition.dart';
import 'package:image_picker/image_picker.dart';
import '../../core/design_system/app_palette.dart';
import '../../core/design_system/tokens.dart';
import '../../core/network/api_client.dart';

class LabReportUploadScreen extends ConsumerStatefulWidget {
  const LabReportUploadScreen({super.key});

  @override
  ConsumerState<LabReportUploadScreen> createState() => _LabReportUploadScreenState();
}

class _LabReportUploadScreenState extends ConsumerState<LabReportUploadScreen> {
  bool   _scanning  = false;
  bool   _uploading = false;
  String? _extractedText;
  String? _reportId;
  String? _error;

  final _labNameController  = TextEditingController();
  DateTime _reportDate      = DateTime.now();

  @override
  void dispose() {
    _labNameController.dispose();
    super.dispose();
  }

  Future<void> _pickAndOcr(ImageSource source) async {
    setState(() { _scanning = true; _error = null; });
    try {
      final picker = ImagePicker();
      final file   = await picker.pickImage(
        source: source,
        imageQuality: 90,
        maxWidth: 2000,
      );
      if (file == null) { setState(() => _scanning = false); return; }

      final recognizer = TextRecognizer(script: TextRecognitionScript.latin);
      final inputImage = InputImage.fromFilePath(file.path);
      final result     = await recognizer.processImage(inputImage);
      await recognizer.close();

      if (mounted) {
        setState(() {
          _extractedText = result.text;
          _scanning      = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() { _error = e.toString(); _scanning = false; });
    }
  }

  Future<void> _upload() async {
    if (_extractedText == null) return;
    setState(() { _uploading = true; _error = null; });
    try {
      final api  = ref.read(apiClientProvider);
      final resp = await api.post<Map<String, dynamic>>(
        '/api/v1/biomarker/lab-reports/upload',
        data: {
          'reportDate': _reportDate.toIso8601String().substring(0, 10),
          'labName':    _labNameController.text.trim().isEmpty ? null : _labNameController.text.trim(),
          'ocrText':    _extractedText,
        },
      );
      if (mounted) {
        setState(() {
          _reportId  = resp.data?['reportId'] as String?;
          _uploading = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() { _error = e.toString(); _uploading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Upload Lab Report')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Scan / pick buttons
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: _scanning ? null : () => _pickAndOcr(ImageSource.camera),
                    icon: const Icon(Icons.camera_alt),
                    label: const Text('Scan Report'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: _scanning ? null : () => _pickAndOcr(ImageSource.gallery),
                    icon: const Icon(Icons.photo_library),
                    label: const Text('From Gallery'),
                  ),
                ),
              ],
            ),
            if (_scanning) ...[
              const SizedBox(height: 16),
              const Center(child: AppLoader()),
              const Center(child: Text('Reading report...')),
            ],
            if (_extractedText != null && !_scanning) ...[
              const SizedBox(height: 16),
              const Text('Report date', style: TextStyle(fontWeight: FontWeight.w600)),
              const SizedBox(height: 4),
              InkWell(
                onTap: () async {
                  final d = await showDatePicker(
                    context: context,
                    initialDate: _reportDate,
                    firstDate: DateTime(2020),
                    lastDate: DateTime.now(),
                  );
                  if (d != null && mounted) setState(() => _reportDate = d);
                },
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  decoration: BoxDecoration(
                    border: Border.all(color: Colors.grey.shade400),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.calendar_today, size: 16),
                      const SizedBox(width: 8),
                      Text(_reportDate.toIso8601String().substring(0, 10)),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _labNameController,
                decoration: const InputDecoration(
                  labelText: 'Lab name (optional)',
                  hintText: 'e.g. SRL Diagnostics',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 12),
              Text(
                'Extracted text preview',
                style: AppType.bodySmall.copyWith(color: context.colors.subtle),
              ),
              const SizedBox(height: 4),
              Container(
                height: 150,
                width: double.infinity,
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: Colors.grey.shade100,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: SingleChildScrollView(
                  child: Text(
                    _extractedText!,
                    style: AppType.labelSmall.copyWith(fontFamily: 'monospace'),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              FilledButton.icon(
                onPressed: _uploading ? null : _upload,
                icon: _uploading
                    ? const SizedBox(
                        width: 16, height: 16,
                        child: AppLoader(size: 20, strokeWidth: 2),
                      )
                    : const Icon(Icons.upload),
                label: const Text('Upload & Parse'),
                style: FilledButton.styleFrom(minimumSize: const Size(double.infinity, 48)),
              ),
            ],
            if (_reportId != null) ...[
              const SizedBox(height: 16),
              const Icon(Icons.check_circle, color: Colors.green, size: 40),
              const SizedBox(height: 8),
              const Text('Report uploaded! Values are being extracted.'),
              Text(
                'Results will appear in your lab history within a few seconds.',
                style: AppType.bodySmall.copyWith(color: context.colors.subtle),
              ),
            ],
            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(_error!, style: const TextStyle(color: Colors.red)),
            ],
          ],
        ),
      ),
    );
  }
}
