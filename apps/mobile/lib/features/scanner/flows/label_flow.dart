import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/design_system/app_palette.dart';
import '../../../core/design_system/tokens.dart';
import '../ocr_mlkit.dart';

// Label scan flow — shows per-field OCR results with confidence indicators.
// Low confidence fields trigger confirmation UI before submitting to API.

class LabelFlowResult extends ConsumerStatefulWidget {
  const LabelFlowResult({super.key, required this.ocrResult});
  final OcrResult ocrResult;

  @override
  ConsumerState<LabelFlowResult> createState() => _LabelFlowResultState();
}

class _LabelFlowResultState extends ConsumerState<LabelFlowResult> {
  bool _submitting = false;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Nutrition label')),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.xl),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _ConfidenceBanner(confidence: widget.ocrResult.confidence),
              const SizedBox(height: AppSpacing.xl),
              const Text('Extracted text', style: AppType.titleMedium),
              const SizedBox(height: AppSpacing.s),
              Expanded(
                child: Container(
                  padding: const EdgeInsets.all(AppSpacing.l),
                  decoration: BoxDecoration(
                    color: context.colors.surfaceVariant,
                    borderRadius: BorderRadius.circular(AppSpacing.chipRadius),
                  ),
                  child: SingleChildScrollView(
                    child: Text(
                      widget.ocrResult.rawText.isEmpty
                          ? 'No text extracted. Please try a clearer photo.'
                          : widget.ocrResult.rawText,
                      style: AppType.bodySmall.copyWith(fontFamily: 'monospace'),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: AppSpacing.xl),
              if (widget.ocrResult.needsUserConfirmation)
                _LowConfidenceWarning(onRetry: () => Navigator.of(context).pop()),
              const SizedBox(height: AppSpacing.m),
              FilledButton(
                onPressed: _submitting || widget.ocrResult.rawText.isEmpty ? null : _submit,
                child: _submitting
                    ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : Text(widget.ocrResult.needsUserConfirmation ? 'Submit anyway' : 'Analyse nutrition'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _submit() async {
    setState(() => _submitting = true);
    // Phase 5: submit to POST /v1/scans/ocr — implemented via api_client
    // For now: show "submitted" confirmation
    await Future<void>.delayed(const Duration(milliseconds: 500)); // design-governance:ignore: UX settle delay, not an animation
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Label submitted for analysis — results coming soon')),
    );
    setState(() => _submitting = false);
  }
}

class _ConfidenceBanner extends StatelessWidget {
  const _ConfidenceBanner({required this.confidence});
  final double confidence;

  Color _color(BuildContext context) {
    if (confidence >= 0.7) return context.colors.success;
    if (confidence >= 0.4) return context.colors.warning;
    return context.colors.error;
  }

  String get _label {
    if (confidence >= 0.7) return 'Good OCR quality';
    if (confidence >= 0.4) return 'Medium OCR quality — please review';
    return 'Low OCR quality — consider retaking photo';
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.l),
      decoration: BoxDecoration(
        color: _color(context).withAlpha(15),
        borderRadius: BorderRadius.circular(AppSpacing.chipRadius),
        border: Border.all(color: _color(context).withAlpha(60)),
      ),
      child: Row(children: [
        Icon(
          confidence >= 0.7 ? Icons.check_circle_outline : Icons.info_outline,
          color: _color(context), size: 20,
        ),
        const SizedBox(width: AppSpacing.m),
        Expanded(child: Text(_label, style: AppType.bodySmall.copyWith(color: _color(context)))),
        Text('${(confidence * 100).toStringAsFixed(0)}%',
          style: AppType.labelMedium.copyWith(color: _color(context))),
      ]),
    );
  }
}

class _LowConfidenceWarning extends StatelessWidget {
  const _LowConfidenceWarning({required this.onRetry});
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.l),
      decoration: BoxDecoration(
        color: context.colors.warning.withAlpha(15),
        borderRadius: BorderRadius.circular(AppSpacing.chipRadius),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Low confidence OCR', style: AppType.titleSmall),
          const SizedBox(height: AppSpacing.xs),
          const Text(
            'The nutrition label photo is unclear. For accurate results, retake with:\n'
            '• Good lighting (avoid shadows)\n'
            '• Camera parallel to label (avoid angle)\n'
            '• Text in focus (tap to focus)',
            style: AppType.bodySmall,
          ),
          const SizedBox(height: AppSpacing.m),
          OutlinedButton(onPressed: onRetry, child: const Text('Retake photo')),
        ],
      ),
    );
  }
}
