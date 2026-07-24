import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/design_system/app_palette.dart';
import '../../../core/design_system/tokens.dart';
import '../../../core/telemetry/telemetry.dart';
import '../pipeline.dart';
import '../../product/product_screen.dart';

final _log = getLogger('scanner.barcode_flow');

// Barcode scan result flow — shown after a successful barcode scan.
// Displays the product result, a genuine "not found" state, or an offline-queued confirmation.

class BarcodeFlowResult extends ConsumerWidget {
  const BarcodeFlowResult({super.key, required this.result});
  final ScanPipelineResult result;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (!result.success) {
      return _ErrorState(message: result.error ?? 'Scan failed');
    }

    final product = result.product;
    if (product != null) {
      // Navigate to product detail immediately
      WidgetsBinding.instance.addPostFrameCallback((_) {
        Navigator.of(context).pushReplacement(
          MaterialPageRoute<void>(
            builder: (_) => ProductScreen(
              productJson: product,
              diseaseGuidance: result.diseaseGuidance,
              healthScore: result.healthScore,
              safety: result.safety,
            ),
          ),
        );
      });
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    if (result.notFound) {
      _log.info('Rendering not-found screen for barcode ${result.barcode}');
      return _NotFoundState(barcode: result.barcode);
    }

    // Offline: product not yet resolved
    return Scaffold(
      appBar: AppBar(title: const Text('Scan saved')),
      body: Padding(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(AppSpacing.l),
              decoration: BoxDecoration(
                color: context.colors.info.withAlpha(15),
                borderRadius: BorderRadius.circular(AppSpacing.chipRadius),
              ),
              child: Row(children: [
                Icon(Icons.cloud_off, color: context.colors.info),
                const SizedBox(width: AppSpacing.m),
                Expanded(child: Text(
                  'You\'re offline. The barcode (${result.barcode}) has been saved and will sync when you reconnect.',
                  style: AppType.bodyMedium,
                )),
              ]),
            ),
            const SizedBox(height: AppSpacing.xl),
            if (result.barcode != null)
              Text('Barcode: ${result.barcode}', style: AppType.bodySmall.copyWith(color: context.colors.subtle)),
          ],
        ),
      ),
    );
  }
}

class _NotFoundState extends StatelessWidget {
  const _NotFoundState({required this.barcode});
  final String? barcode;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Product not found')),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.xl),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.search_off, color: context.colors.subtle, size: 48),
              const SizedBox(height: AppSpacing.l),
              const Text(
                'We couldn\'t find this product in our database or Open Food Facts.',
                style: AppType.bodyMedium,
                textAlign: TextAlign.center,
              ),
              if (barcode != null) ...[
                const SizedBox(height: AppSpacing.m),
                Text(
                  'Barcode: $barcode',
                  style: AppType.bodySmall.copyWith(color: context.colors.subtle),
                ),
              ],
              const SizedBox(height: AppSpacing.m),
              Text(
                'We\'ve queued it for review so it can be added.',
                style: AppType.bodySmall.copyWith(color: context.colors.subtle),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: AppSpacing.l),
              FilledButton(
                onPressed: () => Navigator.of(context).pop(),
                child: const Text('Scan another product'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ErrorState extends StatelessWidget {
  const _ErrorState({required this.message});
  final String message;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Scan result')),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.xl),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.error_outline, color: context.colors.error, size: 48),
              const SizedBox(height: AppSpacing.l),
              Text(message, style: AppType.bodyMedium, textAlign: TextAlign.center),
              const SizedBox(height: AppSpacing.l),
              FilledButton(
                onPressed: () => Navigator.of(context).pop(),
                child: const Text('Try again'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
