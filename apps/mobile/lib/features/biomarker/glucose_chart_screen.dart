// CGM glucose chart — visualises Dexcom/Libre readings with time-in-range bands.
// Chart rendered using CustomPainter (no external chart library dependency).

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/design_system/tokens.dart';
import '../../core/network/api_client.dart';

class GlucoseChartScreen extends ConsumerStatefulWidget {
  const GlucoseChartScreen({super.key});

  @override
  ConsumerState<GlucoseChartScreen> createState() => _GlucoseChartScreenState();
}

class _GlucoseChartScreenState extends ConsumerState<GlucoseChartScreen> {
  List<_GlucosePoint> _readings = [];
  _TIRStats? _tir;
  bool _loading = true;
  String? _error;
  int _rangeHours = 24;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final api  = ref.read(apiClientProvider);
      final now  = DateTime.now().toUtc();
      final from = now.subtract(Duration(hours: _rangeHours));

      final [readingsResp, tirResp] = await Future.wait([
        api.get<Map<String, dynamic>>(
          '/api/v1/biomarker/glucose/readings',
          params: {
            'from': from.toIso8601String(),
            'to':   now.toIso8601String(),
            'limit': '1000',
          },
        ),
        api.get<Map<String, dynamic>>(
          '/api/v1/biomarker/glucose/tir',
          params: {
            'from': from.toIso8601String(),
            'to':   now.toIso8601String(),
          },
        ),
      ]);

      final rawReadings = readingsResp.data?['readings'] as List<dynamic>? ?? [];
      final readings = rawReadings.map((r) {
        final m = r as Map<String, dynamic>;
        return _GlucosePoint(
          time:  DateTime.parse(m['reading_time'] as String),
          value: (m['value_mgdl'] as num).toDouble(),
          trend: m['trend_arrow'] as String? ?? 'unknown',
        );
      }).toList()..sort((a, b) => a.time.compareTo(b.time));

      final tirData = tirResp.data ?? {};
      final tir = _TIRStats(
        inRange:     (tirData['inRange']   as num?)?.toInt() ?? 0,
        low:         (tirData['low']       as num?)?.toInt() ?? 0,
        veryLow:     (tirData['veryLow']   as num?)?.toInt() ?? 0,
        high:        (tirData['high']      as num?)?.toInt() ?? 0,
        veryHigh:    (tirData['veryHigh']  as num?)?.toInt() ?? 0,
        meanGlucose: (tirData['meanGlucose'] as num?)?.toInt() ?? 0,
        gmi:         (tirData['gmi']       as num?)?.toDouble() ?? 0,
        cv:          (tirData['cv']        as num?)?.toDouble() ?? 0,
      );

      if (mounted) setState(() { _readings = readings; _tir = tir; _loading = false; });
    } catch (e) {
      if (mounted) setState(() { _error = e.toString(); _loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Glucose Trends'),
        actions: [
          SegmentedButton<int>(
            segments: const [
              ButtonSegment(value: 6,  label: Text('6h')),
              ButtonSegment(value: 24, label: Text('24h')),
              ButtonSegment(value: 72, label: Text('3d')),
            ],
            selected: {_rangeHours},
            onSelectionChanged: (s) {
              setState(() => _rangeHours = s.first);
              _load();
            },
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Text(_error!, style: const TextStyle(color: Colors.red)))
              : _readings.isEmpty
                  ? _EmptyState()
                  : Column(
                      children: [
                        if (_tir != null) _TIRSummaryCard(tir: _tir!),
                        Expanded(
                          child: Padding(
                            padding: const EdgeInsets.all(16),
                            child: CustomPaint(
                              size: const Size(double.infinity, double.infinity),
                              painter: _GlucoseChartPainter(readings: _readings),
                            ),
                          ),
                        ),
                      ],
                    ),
    );
  }
}

class _GlucosePoint {
  const _GlucosePoint({required this.time, required this.value, required this.trend});
  final DateTime time;
  final double value;
  final String trend;
}

class _TIRStats {
  const _TIRStats({
    required this.inRange, required this.low, required this.veryLow,
    required this.high, required this.veryHigh,
    required this.meanGlucose, required this.gmi, required this.cv,
  });
  final int inRange, low, veryLow, high, veryHigh, meanGlucose;
  final double gmi, cv;
}

class _TIRSummaryCard extends StatelessWidget {
  const _TIRSummaryCard({required this.tir});
  final _TIRStats tir;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: _Stat('Mean', '${tir.meanGlucose} mg/dL'),
                ),
                Expanded(child: _Stat('GMI (est. A1c)', '${tir.gmi}%')),
                Expanded(child: _Stat('CV', '${tir.cv}%')),
              ],
            ),
            const SizedBox(height: 8),
            // TIR bar
            ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: Row(
                children: [
                  _TIRSegment(pct: tir.veryLow, color: Colors.red.shade900),
                  _TIRSegment(pct: tir.low,     color: Colors.orange),
                  _TIRSegment(pct: tir.inRange,  color: Colors.green),
                  _TIRSegment(pct: tir.high,     color: Colors.amber.shade700),
                  _TIRSegment(pct: tir.veryHigh, color: Colors.red),
                ],
              ),
            ),
            const SizedBox(height: 4),
            Text(
              'Time in Range: ${tir.inRange}%  •  Target: ≥70%',
              style: AppType.bodySmall.copyWith(color: AppColors.subtle),
            ),
          ],
        ),
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat(this.label, this.value);
  final String label, value;
  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(label, style: AppType.bodySmall.copyWith(color: AppColors.subtle)),
      Text(value, style: const TextStyle(fontWeight: FontWeight.bold)),
    ],
  );
}

class _TIRSegment extends StatelessWidget {
  const _TIRSegment({required this.pct, required this.color});
  final int pct;
  final Color color;
  @override
  Widget build(BuildContext context) => pct <= 0
      ? const SizedBox.shrink()
      : Expanded(
          flex: pct,
          child: Container(height: 12, color: color),
        );
}

class _EmptyState extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Center(
    child: Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        const Icon(Icons.show_chart, size: 64, color: Colors.grey),
        const SizedBox(height: 16),
        const Text('No glucose readings yet'),
        const SizedBox(height: 8),
        Text(
          'Connect a CGM device to see your glucose trends.',
          style: AppType.bodySmall.copyWith(color: AppColors.subtle),
          textAlign: TextAlign.center,
        ),
      ],
    ),
  );
}

class _GlucoseChartPainter extends CustomPainter {
  const _GlucoseChartPainter({required this.readings});
  final List<_GlucosePoint> readings;

  static const double targetLow  = 70;
  static const double targetHigh = 180;
  static const double yMin       = 40;
  static const double yMax       = 300;

  @override
  void paint(Canvas canvas, Size size) {
    if (readings.isEmpty) return;

    final minTime = readings.first.time.millisecondsSinceEpoch.toDouble();
    final maxTime = readings.last.time.millisecondsSinceEpoch.toDouble();
    if (maxTime == minTime) return;

    double xOf(DateTime t) =>
        (t.millisecondsSinceEpoch - minTime) / (maxTime - minTime) * size.width;
    double yOf(double v) =>
        size.height - ((v - yMin) / (yMax - yMin)) * size.height;

    // Draw target range band (70–180 mg/dL)
    final bandPaint = Paint()..color = Colors.green.withValues(alpha: 0.08);
    canvas.drawRect(
      Rect.fromLTRB(0, yOf(targetHigh), size.width, yOf(targetLow)),
      bandPaint,
    );

    // Target range lines
    final linePaint = Paint()
      ..color = Colors.green.withValues(alpha: 0.4)
      ..strokeWidth = 1;
    canvas.drawLine(Offset(0, yOf(targetHigh)), Offset(size.width, yOf(targetHigh)), linePaint);
    canvas.drawLine(Offset(0, yOf(targetLow)),  Offset(size.width, yOf(targetLow)),  linePaint);

    // Glucose line
    final path    = Path();
    final dotPaint = Paint()..style = PaintingStyle.fill;

    for (var i = 0; i < readings.length; i++) {
      final r = readings[i];
      final x = xOf(r.time);
      final y = yOf(r.value);

      if (i == 0) {
        path.moveTo(x, y);
      } else {
        path.lineTo(x, y);
      }

      dotPaint.color = r.value < targetLow
          ? Colors.orange
          : r.value > targetHigh
              ? Colors.red
              : Colors.green;
      canvas.drawCircle(Offset(x, y), 2.5, dotPaint);
    }

    canvas.drawPath(
      path,
      Paint()
        ..color = Colors.blue.shade400
        ..strokeWidth = 1.5
        ..style = PaintingStyle.stroke,
    );
  }

  @override
  bool shouldRepaint(_GlucoseChartPainter old) => old.readings != readings;
}
