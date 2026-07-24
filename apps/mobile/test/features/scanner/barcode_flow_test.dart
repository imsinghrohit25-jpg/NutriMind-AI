// Widget tests for BarcodeFlowResult's new "genuine not found" state (OpenFoodFacts fallback
// hardening) — verifies it renders distinctly from the pre-existing "offline, will sync" state
// instead of collapsing both into the same misleading message.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nutrimind/features/scanner/flows/barcode_flow.dart';
import 'package:nutrimind/features/scanner/pipeline.dart';

void main() {
  group('BarcodeFlowResult', () {
    testWidgets('shows a dedicated not-found screen when notFound is true', (tester) async {
      await tester.pumpWidget(const ProviderScope(
        child: MaterialApp(
          home: BarcodeFlowResult(
            result: ScanPipelineResult(
              success: true,
              barcode: '0000000000001',
              notFound: true,
            ),
          ),
        ),
      ));

      expect(find.text('Product not found'), findsOneWidget);
      expect(find.textContaining('0000000000001'), findsOneWidget);
      expect(find.text('Scan saved'), findsNothing);
    });

    testWidgets('shows the offline-queued screen when product is null and notFound is false', (tester) async {
      await tester.pumpWidget(const ProviderScope(
        child: MaterialApp(
          home: BarcodeFlowResult(
            result: ScanPipelineResult(
              success: true,
              barcode: '3017620422003',
            ),
          ),
        ),
      ));

      expect(find.text('Scan saved'), findsOneWidget);
      expect(find.textContaining('offline'), findsOneWidget);
    });

    testWidgets('shows the error state when scan itself failed', (tester) async {
      await tester.pumpWidget(const ProviderScope(
        child: MaterialApp(
          home: BarcodeFlowResult(
            result: ScanPipelineResult(success: false, error: 'No barcode detected'),
          ),
        ),
      ));

      expect(find.text('No barcode detected'), findsOneWidget);
    });
  });
}
