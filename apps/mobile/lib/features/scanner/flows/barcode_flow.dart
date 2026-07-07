import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/design_system/tokens.dart';
import '../pipeline.dart';
import '../../product/product_screen.dart';

// Barcode scan result flow — shown after a successful barcode scan.
// Displays the product result or an offline-queued confirmation.

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
            builder: (_) => ProductScreen(productJson: product),
          ),
        );
      });
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
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
                color: AppColors.info.withAlpha(15),
                borderRadius: BorderRadius.circular(AppSpacing.chipRadius),
              ),
              child: Row(children: [
                const Icon(Icons.cloud_off, color: AppColors.info),
                const SizedBox(width: AppSpacing.m),
                Expanded(child: Text(
                  'You\'re offline. The barcode (${result.barcode}) has been saved and will sync when you reconnect.',
                  style: AppType.bodyMedium,
                )),
              ]),
            ),
            const SizedBox(height: AppSpacing.xl),
            if (result.barcode != null)
              Text('Barcode: ${result.barcode}', style: AppType.bodySmall.copyWith(color: AppColors.subtle)),
          ],
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
              const Icon(Icons.error_outline, color: AppColors.error, size: 48),
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
