// AI Recipe Generator screen.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/design_system/app_palette.dart';
import '../../core/design_system/tokens.dart';
import '../../core/network/api_client.dart';

class RecipeScreen extends ConsumerStatefulWidget {
  const RecipeScreen({super.key});

  @override
  ConsumerState<RecipeScreen> createState() => _RecipeScreenState();
}

class _RecipeScreenState extends ConsumerState<RecipeScreen> {
  final _promptController = TextEditingController();
  bool _generating = false;
  _Recipe? _recipe;
  String? _error;
  String _dietType = 'vegetarian';
  int _servings = 2;

  @override
  void dispose() {
    _promptController.dispose();
    super.dispose();
  }

  Future<void> _generate() async {
    final prompt = _promptController.text.trim();
    if (prompt.isEmpty) return;
    setState(() { _generating = true; _error = null; _recipe = null; });
    try {
      final api  = ref.read(apiClientProvider);
      final resp = await api.post<Map<String, dynamic>>(
        '/api/v1/restaurant/recipe/generate',
        data: {
          'prompt':    prompt,
          'servings':  _servings,
          'dietType':  _dietType,
        },
      );
      final d = resp.data ?? {};
      if (mounted) {
        setState(() {
          _recipe = _Recipe(
            name:        d['name'] as String? ?? 'Recipe',
            servings:    d['servings'] as int? ?? _servings,
            prepTime:    d['prepTimeMin'] as int? ?? 0,
            cookTime:    d['cookTimeMin'] as int? ?? 0,
            ingredients: (d['ingredients'] as List<dynamic>? ?? []).map((i) {
              final m = i as Map<String, dynamic>;
              return '${m['quantity']} ${m['unit']} ${m['name']}';
            }).toList(),
            steps:       (d['steps'] as List<dynamic>? ?? [])
                .map((s) => s as String)
                .toList(),
            kcalPerServing: (d['perServingNutrition'] as Map<String, dynamic>?)?['calories'] as int? ?? 0,
            proteinPerServing: (d['perServingNutrition'] as Map<String, dynamic>?)?['protein'] as double? ?? 0,
            tags:        (d['tags'] as List<dynamic>? ?? []).map((t) => t as String).toList(),
          );
          _generating = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() { _error = e.toString(); _generating = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('AI Recipe Generator')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            TextField(
              controller: _promptController,
              decoration: const InputDecoration(
                labelText: 'What would you like to cook?',
                hintText: 'e.g. high-protein paneer dish with spinach',
                border: OutlineInputBorder(),
              ),
              maxLines: 2,
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: DropdownButtonFormField<String>(
                    initialValue: _dietType,
                    decoration: const InputDecoration(
                      labelText: 'Diet',
                      border: OutlineInputBorder(),
                      contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    ),
                    items: const [
                      DropdownMenuItem(value: 'vegetarian',     child: Text('Vegetarian')),
                      DropdownMenuItem(value: 'vegan',          child: Text('Vegan')),
                      DropdownMenuItem(value: 'eggetarian',     child: Text('Eggetarian')),
                      DropdownMenuItem(value: 'non-vegetarian', child: Text('Non-Veg')),
                    ],
                    onChanged: (v) => setState(() => _dietType = v ?? 'vegetarian'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: DropdownButtonFormField<int>(
                    initialValue: _servings,
                    decoration: const InputDecoration(
                      labelText: 'Servings',
                      border: OutlineInputBorder(),
                      contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    ),
                    items: [1, 2, 4, 6].map((n) => DropdownMenuItem(
                      value: n, child: Text('$n'),
                    )).toList(),
                    onChanged: (v) => setState(() => _servings = v ?? 2),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            FilledButton.icon(
              onPressed: _generating ? null : _generate,
              icon: _generating
                  ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                  : const Icon(Icons.auto_awesome),
              label: const Text('Generate Recipe'),
              style: FilledButton.styleFrom(minimumSize: const Size(double.infinity, 48)),
            ),
            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(_error!, style: const TextStyle(color: Colors.red)),
            ],
            if (_recipe != null) ...[
              const SizedBox(height: 24),
              _RecipeCard(recipe: _recipe!),
            ],
          ],
        ),
      ),
    );
  }
}

class _Recipe {
  const _Recipe({
    required this.name, required this.servings, required this.prepTime,
    required this.cookTime, required this.ingredients, required this.steps,
    required this.kcalPerServing, required this.proteinPerServing,
    required this.tags,
  });
  final String name;
  final int servings, prepTime, cookTime, kcalPerServing;
  final double proteinPerServing;
  final List<String> ingredients, steps, tags;
}

class _RecipeCard extends StatelessWidget {
  const _RecipeCard({required this.recipe});
  final _Recipe recipe;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(recipe.name, style: AppType.headlineLarge.copyWith(fontWeight: FontWeight.bold)),
        const SizedBox(height: 4),
        Row(
          children: [
            const Icon(Icons.timer, size: 14, color: Colors.grey),
            Text(' ${recipe.prepTime + recipe.cookTime} min', style: AppType.bodySmall.copyWith(color: context.colors.subtle)),
            const SizedBox(width: 12),
            const Icon(Icons.people, size: 14, color: Colors.grey),
            Text(' ${recipe.servings} servings', style: AppType.bodySmall.copyWith(color: context.colors.subtle)),
            const SizedBox(width: 12),
            const Icon(Icons.local_fire_department, size: 14, color: Colors.orange),
            Text(' ${recipe.kcalPerServing} kcal/serving', style: AppType.bodySmall.copyWith(color: context.colors.subtle)),
          ],
        ),
        if (recipe.tags.isNotEmpty) ...[
          const SizedBox(height: 8),
          Wrap(
            spacing: 6,
            children: recipe.tags.map((t) => Chip(
              label: Text(t, style: AppType.labelSmall),
              materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
            )).toList(),
          ),
        ],
        const SizedBox(height: 16),
        Text('Ingredients', style: AppType.titleMedium.copyWith(fontWeight: FontWeight.bold)),
        const SizedBox(height: 8),
        ...recipe.ingredients.map((i) => Padding(
          padding: const EdgeInsets.only(bottom: 4),
          child: Row(
            children: [
              const Icon(Icons.fiber_manual_record, size: 8, color: Colors.green),
              const SizedBox(width: 8),
              Expanded(child: Text(i)),
            ],
          ),
        )),
        const SizedBox(height: 16),
        Text('Method', style: AppType.titleMedium.copyWith(fontWeight: FontWeight.bold)),
        const SizedBox(height: 8),
        ...recipe.steps.asMap().entries.map((e) => Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 24, height: 24,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: context.colors.primary.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  '${e.key + 1}',
                  style: AppType.labelSmall.copyWith(color: context.colors.primary, fontWeight: FontWeight.bold),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(child: Text(e.value)),
            ],
          ),
        )),
      ],
    );
  }
}
