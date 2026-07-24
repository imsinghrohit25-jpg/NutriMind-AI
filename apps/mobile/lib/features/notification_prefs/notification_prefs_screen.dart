import 'package:flutter/material.dart';
import '../../core/design_system/app_palette.dart';
import '../../core/design_system/tokens.dart';

/// Notification preferences screen — per-user opt-in/out for push notification types.
/// Allergen alerts are safety-critical and cannot be disabled (greyed out with lock icon).
class NotificationPrefsScreen extends StatefulWidget {
  final Map<String, bool> initialPrefs;
  final Future<void> Function(Map<String, bool> updated) onSave;

  const NotificationPrefsScreen({
    super.key,
    required this.initialPrefs,
    required this.onSave,
  });

  @override
  State<NotificationPrefsScreen> createState() => _NotificationPrefsScreenState();
}

class _NotificationPrefsScreenState extends State<NotificationPrefsScreen> {
  late Map<String, bool> _prefs;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _prefs = Map<String, bool>.from(widget.initialPrefs);
  }

  Future<void> _save() async {
    setState(() { _saving = true; });
    try {
      await widget.onSave(_prefs);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Preferences saved')),
        );
      }
    } finally {
      if (mounted) setState(() { _saving = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Notification Settings'),
        actions: [
          TextButton(
            onPressed: _saving ? null : _save,
            child: _saving
                ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                : const Text('Save'),
          ),
        ],
      ),
      body: ListView(
        children: [
          const _SectionHeader(title: 'Reports'),
          _PrefTile(
            title: 'Weekly nutrition report',
            subtitle: 'Sent every Monday with your weekly summary',
            icon: Icons.bar_chart,
            value: _prefs['weeklyReport'] ?? true,
            onChanged: (v) => setState(() { _prefs['weeklyReport'] = v; }),
          ),

          const _SectionHeader(title: 'Alerts'),
          _PrefTile(
            title: 'Allergen alerts',
            subtitle: 'Critical safety alerts — cannot be disabled',
            icon: Icons.warning_amber,
            value: _prefs['allergenAlert'] ?? true,
            onChanged: null,  // locked — safety critical
            locked: true,
          ),
          _PrefTile(
            title: 'Budget overrun alert',
            subtitle: 'Notified when daily calorie or sodium budget is exceeded',
            icon: Icons.notifications_active,
            value: _prefs['budgetOverrun'] ?? true,
            onChanged: (v) => setState(() { _prefs['budgetOverrun'] = v; }),
          ),

          const _SectionHeader(title: 'Reminders'),
          _PrefTile(
            title: 'Daily scan reminder',
            subtitle: 'Nudge when you haven\'t scanned anything today',
            icon: Icons.qr_code_scanner,
            value: _prefs['scanReminder'] ?? false,
            onChanged: (v) => setState(() { _prefs['scanReminder'] = v; }),
          ),
        ],
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  final String title;

  const _SectionHeader({required this.title});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(AppSpacing.m, AppSpacing.m, AppSpacing.m, AppSpacing.xs),
      child: Text(title.toUpperCase(), style: AppType.bodySmall.copyWith(color: context.colors.subtle, letterSpacing: 1.2)),
    );
  }
}

class _PrefTile extends StatelessWidget {
  final String title;
  final String subtitle;
  final IconData icon;
  final bool value;
  final ValueChanged<bool>? onChanged;
  final bool locked;

  const _PrefTile({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.value,
    required this.onChanged,
    this.locked = false,
  });

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: Icon(icon, color: locked ? context.colors.subtle : null),
      title: Row(
        children: [
          Text(title, style: AppType.bodyMedium),
          if (locked) ...[
            const SizedBox(width: AppSpacing.xs),
            Icon(Icons.lock, size: 14, color: context.colors.subtle),
          ],
        ],
      ),
      subtitle: Text(subtitle, style: AppType.bodySmall.copyWith(color: context.colors.subtle)),
      trailing: Switch(
        value: value,
        onChanged: onChanged,
      ),
    );
  }
}
