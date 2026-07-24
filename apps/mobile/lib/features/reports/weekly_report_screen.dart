import 'package:flutter/material.dart';
import '../../core/design_system/app_palette.dart';
import '../../core/design_system/tokens.dart';

/// Weekly nutrition report screen — shown when user taps the push notification
/// deep-link /reports/weekly, or navigates from History tab.
class WeeklyReportScreen extends StatelessWidget {
  final Map<String, dynamic> report;  // RenderedReport + DailyGapReport from API

  const WeeklyReportScreen({super.key, required this.report});

  @override
  Widget build(BuildContext context) {
    final headline      = report['headline'] as String? ?? 'Your weekly summary';
    final fibreSummary  = report['fibreSummary'] as String?;
    final sodiumSummary = report['sodiumSummary'] as String?;
    final topWins       = (report['topWins'] as List<dynamic>?)?.cast<String>() ?? [];
    final topConcerns   = (report['topConcerns'] as List<dynamic>?)?.cast<String>() ?? [];
    final weekStart     = report['weekStart'] as String? ?? '';

    return Scaffold(
      appBar: AppBar(title: const Text('Weekly Report')),
      body: ListView(
        padding: const EdgeInsets.all(AppSpacing.m),
        children: [
          Text(weekStart, style: AppType.bodySmall.copyWith(color: context.colors.subtle)),
          const SizedBox(height: AppSpacing.xs),
          Text(headline, style: AppType.titleLarge),
          const SizedBox(height: AppSpacing.m),

          // Key stats row
          if (fibreSummary != null || sodiumSummary != null)
            Row(
              children: [
                if (fibreSummary != null)
                  Expanded(child: _StatCard(label: 'Fibre avg', value: fibreSummary)),
                if (fibreSummary != null && sodiumSummary != null)
                  const SizedBox(width: AppSpacing.s),
                if (sodiumSummary != null)
                  Expanded(child: _StatCard(label: 'Sodium avg', value: sodiumSummary)),
              ],
            ),

          if (topConcerns.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.m),
            const Text('Areas to watch', style: AppType.titleMedium),
            const SizedBox(height: AppSpacing.xs),
            ..._bulletList(topConcerns, color: AppColors.scorePoor),
          ],

          if (topWins.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.m),
            const Text('What went well', style: AppType.titleMedium),
            const SizedBox(height: AppSpacing.xs),
            ..._bulletList(topWins, color: AppColors.scoreGood),
          ],

          const SizedBox(height: AppSpacing.m),
          const _Disclaimer(),
        ],
      ),
    );
  }

  List<Widget> _bulletList(List<String> items, {required Color color}) {
    return items.map((item) => Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('• ', style: AppType.bodyMedium.copyWith(color: color)),
          Expanded(child: Text(item, style: AppType.bodyMedium)),
        ],
      ),
    )).toList();
  }
}

class _StatCard extends StatelessWidget {
  final String label;
  final String value;

  const _StatCard({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.s),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: AppType.bodySmall.copyWith(color: context.colors.subtle)),
            const SizedBox(height: 4),
            Text(value, style: AppType.bodySmall),
          ],
        ),
      ),
    );
  }
}

class _Disclaimer extends StatelessWidget {
  const _Disclaimer();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.s),
      decoration: BoxDecoration(
        color: context.colors.surface,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        'This report is based on products you scanned during the week. '
        'It is not a substitute for advice from a registered dietitian.',
        style: AppType.bodySmall.copyWith(color: context.colors.subtle),
      ),
    );
  }
}
