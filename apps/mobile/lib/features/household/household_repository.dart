import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

part 'household_repository.g.dart';

class HouseholdMember {
  const HouseholdMember({
    required this.id,
    required this.name,
    this.ageYears,
    this.sex,
    this.tdeeKcal,
    this.allergenFlags = const [],
  });

  final String id;
  final String name;
  final int? ageYears;
  final String? sex;
  final double? tdeeKcal;
  final List<String> allergenFlags;

  Map<String, dynamic> toJson() => {
    'name': name,
    if (ageYears != null) 'age_years': ageYears,
    if (sex != null) 'sex': sex,
    if (tdeeKcal != null) 'tdee_kcal': tdeeKcal,
    'allergen_flags': allergenFlags,
  };

  factory HouseholdMember.fromRow(Map<String, dynamic> row) {
    return HouseholdMember(
      id: row['id'] as String,
      name: row['name'] as String,
      ageYears: row['age_years'] as int?,
      sex: row['sex'] as String?,
      tdeeKcal: (row['tdee_kcal'] as num?)?.toDouble(),
      allergenFlags: List<String>.from(row['allergen_flags'] as List? ?? []),
    );
  }
}

@riverpod
HouseholdRepository householdRepository(Ref ref) {
  return HouseholdRepository(Supabase.instance.client);
}

class HouseholdRepository {
  HouseholdRepository(this._client);
  final SupabaseClient _client;

  Future<List<HouseholdMember>> getMembers() async {
    final rows = await _client
        .from('household_members')
        .select()
        .order('created_at');
    return (rows as List).map((r) => HouseholdMember.fromRow(r as Map<String, dynamic>)).toList();
  }

  Future<HouseholdMember> addMember(HouseholdMember member) async {
    final row = await _client
        .from('household_members')
        .insert(member.toJson())
        .select()
        .single();
    return HouseholdMember.fromRow(row);
  }

  Future<void> updateMember(String id, Map<String, dynamic> updates) async {
    await _client.from('household_members').update(updates).eq('id', id);
  }

  Future<void> deleteMember(String id) async {
    await _client.from('household_members').delete().eq('id', id);
  }
}

@riverpod
Future<List<HouseholdMember>> householdMembers(Ref ref) async {
  final repo = ref.watch(householdRepositoryProvider);
  return repo.getMembers();
}
