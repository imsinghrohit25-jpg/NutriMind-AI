import '../../../core/design_system/components/app_loader.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/design_system/app_palette.dart';
import '../../../core/design_system/tokens.dart';
import '../household_repository.dart';

class HouseholdScreen extends ConsumerWidget {
  const HouseholdScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final membersAsync = ref.watch(householdMembersProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Household'),
        actions: [
          IconButton(
            icon: const Icon(Icons.add),
            onPressed: () => _showAddMemberSheet(context, ref),
            tooltip: 'Add member',
          ),
        ],
      ),
      body: membersAsync.when(
        loading: () => const Center(child: AppLoader()),
        error: (e, _) => Center(child: Text('Error: $e', style: AppType.bodyMedium)),
        data: (members) => members.isEmpty
            ? _EmptyState(onAdd: () => _showAddMemberSheet(context, ref))
            : ListView.separated(
                padding: const EdgeInsets.all(AppSpacing.xl),
                itemCount: members.length,
                separatorBuilder: (_, __) => const SizedBox(height: AppSpacing.m),
                itemBuilder: (_, i) => _MemberCard(member: members[i], ref: ref),
              ),
      ),
    );
  }

  void _showAddMemberSheet(BuildContext context, WidgetRef ref) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => _AddMemberSheet(ref: ref),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.onAdd});
  final VoidCallback onAdd;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xxxl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.family_restroom, size: 64, color: context.colors.subtle),
            const SizedBox(height: AppSpacing.xl),
            const Text('No household members', style: AppType.headlineMedium),
            const SizedBox(height: AppSpacing.s),
            Text('Add family members to track nutrition for everyone', style: AppType.bodyMedium.copyWith(color: context.colors.subtle), textAlign: TextAlign.center),
            const SizedBox(height: AppSpacing.xl),
            FilledButton.icon(
              onPressed: onAdd,
              icon: const Icon(Icons.add),
              label: const Text('Add member'),
            ),
          ],
        ),
      ),
    );
  }
}

class _MemberCard extends StatelessWidget {
  const _MemberCard({required this.member, required this.ref});
  final HouseholdMember member;
  final WidgetRef ref;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: context.colors.primary.withAlpha(20),
          child: Text(
            member.name.isNotEmpty ? member.name[0].toUpperCase() : '?',
            style: AppType.titleMedium.copyWith(color: context.colors.primary),
          ),
        ),
        title: Text(member.name, style: AppType.titleMedium),
        subtitle: Text(
          [
            if (member.ageYears != null) '${member.ageYears} yrs',
            if (member.tdeeKcal != null) '${member.tdeeKcal!.toStringAsFixed(0)} kcal/day',
          ].join(' · '),
          style: AppType.bodySmall.copyWith(color: context.colors.subtle),
        ),
        trailing: IconButton(
          icon: const Icon(Icons.delete_outline),
          onPressed: () async {
            final repo = ref.read(householdRepositoryProvider);
            await repo.deleteMember(member.id);
            ref.invalidate(householdMembersProvider);
          },
        ),
      ),
    );
  }
}

class _AddMemberSheet extends StatefulWidget {
  const _AddMemberSheet({required this.ref});
  final WidgetRef ref;

  @override
  State<_AddMemberSheet> createState() => _AddMemberSheetState();
}

class _AddMemberSheetState extends State<_AddMemberSheet> {
  final _nameCtrl = TextEditingController();
  final _ageCtrl  = TextEditingController();
  String _sex = 'other';
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _nameCtrl.dispose();
    _ageCtrl.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final name = _nameCtrl.text.trim();
    if (name.isEmpty) {
      setState(() => _error = 'Please enter a name');
      return;
    }
    setState(() { _saving = true; _error = null; });
    try {
      final repo = widget.ref.read(householdRepositoryProvider);
      await repo.addMember(HouseholdMember(
        id: '',
        name: name,
        ageYears: int.tryParse(_ageCtrl.text),
        sex: _sex,
      ));
      widget.ref.invalidate(householdMembersProvider);
      if (mounted) Navigator.of(context).pop();
    } catch (e) {
      setState(() => _error = 'Failed to add member. Please try again.');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(
        AppSpacing.xl, AppSpacing.xl, AppSpacing.xl,
        AppSpacing.xl + MediaQuery.of(context).viewInsets.bottom,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Add household member', style: AppType.headlineMedium),
          const SizedBox(height: AppSpacing.xl),
          TextField(
            controller: _nameCtrl,
            textInputAction: TextInputAction.next,
            decoration: const InputDecoration(labelText: 'Name'),
          ),
          const SizedBox(height: AppSpacing.l),
          Row(children: [
            Expanded(child: TextField(
              controller: _ageCtrl,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: 'Age (optional)'),
            )),
            const SizedBox(width: AppSpacing.l),
            DropdownButton<String>(
              value: _sex,
              items: const [
                DropdownMenuItem(value: 'male',   child: Text('Male')),
                DropdownMenuItem(value: 'female', child: Text('Female')),
                DropdownMenuItem(value: 'other',  child: Text('Other')),
              ],
              onChanged: (v) => setState(() => _sex = v!),
            ),
          ]),
          if (_error != null) ...[
            const SizedBox(height: AppSpacing.m),
            Text(_error!, style: AppType.bodySmall.copyWith(color: context.colors.error)),
          ],
          const SizedBox(height: AppSpacing.xl),
          FilledButton(
            onPressed: _saving ? null : _save,
            child: _saving
                ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : const Text('Add member'),
          ),
        ],
      ),
    );
  }
}
