import 'package:flutter/material.dart';
import '../../core/design_system/components/gradient_scaffold.dart';
import '../../core/design_system/components/nutrient_ring.dart';
import '../../core/design_system/app_palette.dart';
import '../../core/design_system/tokens.dart';

/// Full expandable health score screen.
/// Receives the HealthScoreResult JSON from the API. Shows overall score,
/// each sub-score with its label, level, and explanatory notes.
/// LLM explanation (headline + bullets) is shown when available.
class ScoreScreen extends StatelessWidget {
  final Map<String, dynamic> scoreJson;
  final String productName;

  const ScoreScreen({
    super.key,
    required this.scoreJson,
    required this.productName,
  });

  @override
  Widget build(BuildContext context) {
    final score    = (scoreJson['score'] as num?)?.toDouble() ?? 0;
    final band     = scoreJson['band'] as String? ?? 'fair';
    final version  = scoreJson['algorithmVersion'] as String? ?? '—';
    final subscores = scoreJson['subscores'] as Map<String, dynamic>? ?? {};
    final explain  = scoreJson['explain'] as Map<String, dynamic>?;

    return GradientScaffold(
      appBar: AppBar(title: Text(productName), backgroundColor: Colors.transparent),
      body: ListView(
        padding: const EdgeInsets.all(AppSpacing.m),
        children: [
          _ScoreGauge(score: score, band: band),
          const SizedBox(height: AppSpacing.xl),
          if (explain != null) ...[
            _ExplainCard(explain: explain),
            const SizedBox(height: AppSpacing.l),
          ],
          const Text('Sub-scores', style: AppType.titleMedium),
          const SizedBox(height: AppSpacing.s),
          _SubScoreCard(
            label: 'Sodium',
            icon: Icons.water_drop_outlined,
            data: subscores['sodium'] as Map<String, dynamic>? ?? {},
            higherIsBetter: false,
          ),
          _SubScoreCard(
            label: 'Sugar',
            icon: Icons.cookie_outlined,
            data: subscores['sugar'] as Map<String, dynamic>? ?? {},
            higherIsBetter: false,
          ),
          _SubScoreCard(
            label: 'Saturated Fat',
            icon: Icons.opacity_outlined,
            data: subscores['satFat'] as Map<String, dynamic>? ?? {},
            higherIsBetter: false,
          ),
          _SubScoreCard(
            label: 'Trans Fat',
            icon: Icons.warning_amber_outlined,
            data: subscores['transFat'] as Map<String, dynamic>? ?? {},
            higherIsBetter: false,
          ),
          _SubScoreCard(
            label: 'Dietary Fibre',
            icon: Icons.grass_outlined,
            data: subscores['fibre'] as Map<String, dynamic>? ?? {},
            higherIsBetter: true,
          ),
          _SubScoreCard(
            label: 'Protein',
            icon: Icons.fitness_center_outlined,
            data: subscores['protein'] as Map<String, dynamic>? ?? {},
            higherIsBetter: true,
          ),
          _NovaCard(data: subscores['nova'] as Map<String, dynamic>? ?? {}),
          const SizedBox(height: AppSpacing.l),
          _MathFooter(version: version),
          const SizedBox(height: AppSpacing.xl),
          const _Disclaimer(),
        ],
      ),
    );
  }
}

// ── Overall score gauge ─────────────────────────────────────────────────────────

class _ScoreGauge extends StatelessWidget {
  final double score;
  final String band;

  const _ScoreGauge({required this.score, required this.band});

  @override
  Widget build(BuildContext context) {
    final color = _bandColor(band);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.l),
        child: Row(
          children: [
            AnimatedNutrientRing(
              value: score,
              maxValue: 100,
              color: color,
              size: 80,
              strokeWidth: 8,
            ),
            const SizedBox(width: AppSpacing.l),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Health Score', style: AppType.labelMedium),
                  const SizedBox(height: AppSpacing.xs),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.s,
                      vertical: AppSpacing.xs,
                    ),
                    decoration: BoxDecoration(
                      color: color.withAlpha(30),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(
                      band.toUpperCase(),
                      style: AppType.labelSmall.copyWith(color: color, fontWeight: FontWeight.w700),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  const Text('out of 100 — ICMR-NIN/WHO adapted', style: AppType.bodySmall),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Color _bandColor(String band) {
    switch (band) {
      case 'excellent': return AppColors.scoreExcellent;
      case 'good':      return AppColors.scoreGood;
      case 'fair':      return AppColors.scoreFair;
      case 'poor':      return AppColors.scorePoor;
      default:          return AppColors.scoreBad;
    }
  }
}

// ── LLM explanation card ────────────────────────────────────────────────────────

class _ExplainCard extends StatelessWidget {
  final Map<String, dynamic> explain;
  const _ExplainCard({required this.explain});

  @override
  Widget build(BuildContext context) {
    final headline   = explain['headline'] as String? ?? '';
    final bullets    = (explain['bullets'] as List<dynamic>?)?.cast<String>() ?? [];
    final disclaimer = explain['disclaimer'] as String? ?? '';

    return Card(
      color: context.colors.primary.withAlpha(8),
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.m),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Row(children: [
              Icon(Icons.auto_awesome_outlined, size: 16),
              SizedBox(width: AppSpacing.xs),
              Text('AI Explanation', style: AppType.labelMedium),
            ]),
            const SizedBox(height: AppSpacing.s),
            if (headline.isNotEmpty) ...[
              Text(headline, style: AppType.bodyMedium),
              const SizedBox(height: AppSpacing.s),
            ],
            ...bullets.map((b) => Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.xs),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('• ', style: AppType.bodySmall),
                  Expanded(child: Text(b, style: AppType.bodySmall)),
                ],
              ),
            )),
            if (disclaimer.isNotEmpty) ...[
              const SizedBox(height: AppSpacing.s),
              Text(disclaimer, style: AppType.bodySmall.copyWith(color: context.colors.subtle)),
            ],
          ],
        ),
      ),
    );
  }
}

// ── Sub-score card ──────────────────────────────────────────────────────────────

class _SubScoreCard extends StatefulWidget {
  final String label;
  final IconData icon;
  final Map<String, dynamic> data;
  final bool higherIsBetter;

  const _SubScoreCard({
    required this.label,
    required this.icon,
    required this.data,
    required this.higherIsBetter,
  });

  @override
  State<_SubScoreCard> createState() => _SubScoreCardState();
}

class _SubScoreCardState extends State<_SubScoreCard> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final score = (widget.data['score'] as num?)?.toDouble() ?? 50;
    final level = widget.data['level'] as String? ?? 'moderate';
    final notes = widget.data['notes'] as String? ?? '';
    final color = _levelColor(level, widget.higherIsBetter);

    return Card(
      margin: const EdgeInsets.only(bottom: AppSpacing.s),
      child: InkWell(
        borderRadius: BorderRadius.circular(8),
        onTap: () => setState(() => _expanded = !_expanded),
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.m),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(children: [
                Icon(widget.icon, size: 18, color: color),
                const SizedBox(width: AppSpacing.s),
                Expanded(child: Text(widget.label, style: AppType.titleSmall)),
                Text(
                  score.toStringAsFixed(0),
                  style: AppType.titleSmall.copyWith(color: color),
                ),
                const SizedBox(width: AppSpacing.s),
                Icon(
                  _expanded ? Icons.keyboard_arrow_up : Icons.keyboard_arrow_down,
                  size: 18,
                  color: context.colors.subtle,
                ),
              ]),
              const SizedBox(height: AppSpacing.xs),
              LinearProgressIndicator(
                value: score / 100,
                backgroundColor: context.colors.divider,
                color: color,
                minHeight: 4,
                borderRadius: BorderRadius.circular(2),
              ),
              if (_expanded && notes.isNotEmpty) ...[
                const SizedBox(height: AppSpacing.s),
                Text(notes, style: AppType.bodySmall.copyWith(color: context.colors.subtle)),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Color _levelColor(String level, bool higherIsBetter) {
    if (!higherIsBetter) {
      switch (level) {
        case 'very_low': case 'none':  return AppColors.scoreExcellent;
        case 'low':                    return AppColors.scoreGood;
        case 'moderate':               return AppColors.scoreFair;
        case 'high':                   return AppColors.scorePoor;
        case 'very_high':              return AppColors.scoreBad;
        default:                       return AppColors.scoreFair;
      }
    } else {
      switch (level) {
        case 'none':                   return AppColors.scoreBad;
        case 'low':                    return AppColors.scorePoor;
        case 'moderate':               return AppColors.scoreFair;
        case 'high':                   return AppColors.scoreGood;
        case 'very_high':              return AppColors.scoreExcellent;
        default:                       return AppColors.scoreFair;
      }
    }
  }
}

// ── NOVA card ───────────────────────────────────────────────────────────────────

class _NovaCard extends StatefulWidget {
  final Map<String, dynamic> data;
  const _NovaCard({required this.data});

  @override
  State<_NovaCard> createState() => _NovaCardState();
}

class _NovaCardState extends State<_NovaCard> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final group      = widget.data['group'] as int? ?? 3;
    final score      = (widget.data['score'] as num?)?.toDouble() ?? 45;
    final confidence = widget.data['confidence'] as String? ?? 'low';
    final reason     = widget.data['reason'] as String? ?? '';
    final color      = _novaColor(group);

    return Card(
      margin: const EdgeInsets.only(bottom: AppSpacing.s),
      child: InkWell(
        borderRadius: BorderRadius.circular(8),
        onTap: () => setState(() => _expanded = !_expanded),
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.m),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(children: [
                Icon(Icons.category_outlined, size: 18, color: color),
                const SizedBox(width: AppSpacing.s),
                Expanded(child: Text('NOVA Group $group', style: AppType.titleSmall)),
                Text(
                  score.toStringAsFixed(0),
                  style: AppType.titleSmall.copyWith(color: color),
                ),
                const SizedBox(width: AppSpacing.s),
                Icon(
                  _expanded ? Icons.keyboard_arrow_up : Icons.keyboard_arrow_down,
                  size: 18,
                  color: context.colors.subtle,
                ),
              ]),
              const SizedBox(height: AppSpacing.xs),
              LinearProgressIndicator(
                value: score / 100,
                backgroundColor: context.colors.divider,
                color: color,
                minHeight: 4,
                borderRadius: BorderRadius.circular(2),
              ),
              if (_expanded) ...[
                const SizedBox(height: AppSpacing.s),
                Text(_novaDescription(group), style: AppType.bodySmall),
                if (reason.isNotEmpty) ...[
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    '${_confidenceLabel(confidence)}: $reason',
                    style: AppType.bodySmall.copyWith(color: context.colors.subtle),
                  ),
                ],
              ],
            ],
          ),
        ),
      ),
    );
  }

  Color _novaColor(int group) {
    switch (group) {
      case 1:  return AppColors.scoreExcellent;
      case 2:  return AppColors.scoreGood;
      case 3:  return AppColors.scoreFair;
      default: return AppColors.scoreBad;
    }
  }

  String _novaDescription(int group) {
    switch (group) {
      case 1:  return 'NOVA 1 — Unprocessed or minimally processed food (rice, dal, fresh vegetables, milk).';
      case 2:  return 'NOVA 2 — Processed culinary ingredient (ghee, oil, sugar, salt). Used in cooking, not eaten alone.';
      case 3:  return 'NOVA 3 — Processed food (canned fish, salted nuts, traditional pickles, paneer). Limited additives.';
      default: return 'NOVA 4 — Ultra-processed product. Contains additives not used in home cooking (emulsifiers, artificial flavours, preservatives). Monteiro et al. 2019.';
    }
  }

  String _confidenceLabel(String confidence) {
    switch (confidence) {
      case 'high':   return 'From product database';
      case 'medium': return 'Inferred (medium confidence)';
      default:       return 'Inferred (low confidence)';
    }
  }
}

// ── Algorithm transparency footer ───────────────────────────────────────────────

class _MathFooter extends StatelessWidget {
  final String version;
  const _MathFooter({required this.version});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.m),
      decoration: BoxDecoration(
        color: context.colors.surface,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: context.colors.divider),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Score methodology', style: AppType.labelMedium),
          const SizedBox(height: AppSpacing.xs),
          Text(
            'Computed by a deterministic algorithm (v$version). '
            'No AI model sets any score value. '
            'Weights: Sodium 20%, Sugar 20%, Sat. fat 15%, Trans fat 10%, Fibre 15%, Protein 10%, NOVA 10%. '
            'Thresholds: ICMR-NIN RDA 2020, WHO 2023, FSSAI Labelling Regulations 2022.',
            style: AppType.bodySmall.copyWith(color: context.colors.subtle),
          ),
        ],
      ),
    );
  }
}

// ── Medical disclaimer ──────────────────────────────────────────────────────────

class _Disclaimer extends StatelessWidget {
  const _Disclaimer();

  @override
  Widget build(BuildContext context) {
    return Text(
      'This score is for general food literacy only and does not constitute medical advice. '
      'Consult a registered dietitian or physician for personalised dietary guidance.',
      style: AppType.bodySmall.copyWith(color: context.colors.subtle),
      textAlign: TextAlign.center,
    );
  }
}
