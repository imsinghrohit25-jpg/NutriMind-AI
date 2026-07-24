import '../../core/design_system/components/app_loader.dart';
import 'package:flutter/material.dart';
import '../../core/design_system/app_palette.dart';
import '../../core/design_system/tokens.dart';

/// Data rights screen — GDPR/DPDP-compliant export and full account deletion.
/// Gate: deletion flow confirmed by server verification query.
class DataRightsScreen extends StatefulWidget {
  final Future<void> Function() onExport;
  final Future<void> Function() onDelete;

  const DataRightsScreen({
    super.key,
    required this.onExport,
    required this.onDelete,
  });

  @override
  State<DataRightsScreen> createState() => _DataRightsScreenState();
}

class _DataRightsScreenState extends State<DataRightsScreen> {
  bool _exporting = false;
  bool _deleting  = false;

  Future<void> _export() async {
    setState(() { _exporting = true; });
    try {
      await widget.onExport();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Export complete. Check your downloads.')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Export failed. Please try again.')),
        );
      }
    } finally {
      if (mounted) setState(() { _exporting = false; });
    }
  }

  Future<void> _confirmDelete() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete account?'),
        content: const Text(
          'This will permanently erase all your scans, meal logs, and profile data. '
          'This cannot be undone.',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: AppColors.scorePoor),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Delete permanently'),
          ),
        ],
      ),
    );

    if (confirmed != true || !mounted) return;

    setState(() { _deleting = true; });
    try {
      await widget.onDelete();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Account deleted. Thank you for using NutriMind.')),
        );
        // Navigate to login screen after deletion
        Navigator.of(context).popUntil((route) => route.isFirst);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Deletion failed. Please contact support.')),
        );
      }
    } finally {
      if (mounted) setState(() { _deleting = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Your Data')),
      body: ListView(
        padding: const EdgeInsets.all(AppSpacing.m),
        children: [
          const _InfoCard(),
          const SizedBox(height: AppSpacing.m),

          ListTile(
            leading: const Icon(Icons.download),
            title: const Text('Export my data'),
            subtitle: const Text('Download a JSON file with all your scans, meals, and profile.'),
            trailing: _exporting
                ? const SizedBox(width: 20, height: 20, child: AppLoader(size: 20, strokeWidth: 2))
                : const Icon(Icons.chevron_right),
            onTap: _exporting ? null : _export,
          ),

          const Divider(),

          ListTile(
            leading: const Icon(Icons.delete_forever, color: AppColors.scorePoor),
            title: Text(
              'Delete my account',
              style: AppType.bodyMedium.copyWith(color: AppColors.scorePoor),
            ),
            subtitle: const Text('Permanently removes all your data from NutriMind servers.'),
            trailing: _deleting
                ? const SizedBox(width: 20, height: 20, child: AppLoader(size: 20, strokeWidth: 2))
                : const Icon(Icons.chevron_right, color: AppColors.scorePoor),
            onTap: _deleting ? null : _confirmDelete,
          ),
        ],
      ),
    );
  }
}

class _InfoCard extends StatelessWidget {
  const _InfoCard();

  @override
  Widget build(BuildContext context) {
    return Card(
      color: context.colors.surface,
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.m),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Your privacy rights', style: AppType.titleMedium),
            const SizedBox(height: AppSpacing.s),
            Text(
              'Under the Digital Personal Data Protection Act 2023 (India) and GDPR, '
              'you have the right to export or delete all personal data we hold about you.',
              style: AppType.bodySmall.copyWith(color: context.colors.subtle),
            ),
          ],
        ),
      ),
    );
  }
}
