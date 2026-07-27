import 'package:flutter_test/flutter_test.dart';
import 'package:nutrimind/features/meals/meals_providers.dart';

void main() {
  group('MealDayReport.fromBody', () {
    test('parses the wrapped day report (entries, total, gapReport)', () {
      final r = MealDayReport.fromBody({
        'ok': true,
        'data': {
          'date': '2026-07-24',
          'entries': [
            {'productName': 'Idli', 'servingG': 100, 'nutrition': {'energyKcal': 200}},
          ],
          'total': {'energyKcal': 200, 'proteinG': 6},
          'gapReport': {
            'overallStatus': 'under',
            'gaps': [
              {'nutrient': 'Calories', 'consumed': 200, 'budget': 2100},
              {'nutrient': 'Protein', 'consumed': 6, 'budget': 58},
            ],
          },
        },
      });
      expect(r.isEmpty, isFalse);
      expect(r.date, '2026-07-24');
      expect(r.entries, hasLength(1));
      expect(r.consumedKcal, 200);
      expect(r.budgetKcal, 2100); // read from the Calories gap row
      expect(r.overallStatus, 'under');
    });

    test('empty diary → isEmpty, zero consumed, null budget', () {
      final r = MealDayReport.fromBody({
        'data': {'date': '2026-07-24', 'entries': <dynamic>[], 'total': null, 'gapReport': null},
      });
      expect(r.isEmpty, isTrue);
      expect(r.consumedKcal, 0);
      expect(r.budgetKcal, isNull);
      expect(r.overallStatus, 'on_track');
    });

    test('tolerates an unwrapped body and a malformed data field (never throws)', () {
      final unwrapped = MealDayReport.fromBody({
        'date': '2026-07-24',
        'entries': [
          {'productName': 'Dal'},
        ],
        'total': {'energyKcal': 300},
      });
      expect(unwrapped.consumedKcal, 300);
      expect(unwrapped.budgetKcal, isNull); // no gap report
      expect(MealDayReport.fromBody(const {}).isEmpty, isTrue);
      expect(MealDayReport.fromBody({'data': 'nope'}).isEmpty, isTrue);
    });
  });

  group('WeeklyReport.fromBody', () {
    test('parses an available report', () {
      final w = WeeklyReport.fromBody({
        'data': {
          'available': true,
          'weekStart': '2026-07-20',
          'report': {'headline': 'Good week', 'topWins': ['Fibre'], 'topConcerns': ['Sodium'], 'weekStart': '2026-07-20'},
        },
      });
      expect(w.available, isTrue);
      expect(w.weekStart, '2026-07-20');
      expect(w.report!['headline'], 'Good week');
    });

    test('available:false with a null report (nothing logged)', () {
      final w = WeeklyReport.fromBody({'data': {'available': false, 'weekStart': '2026-07-20', 'report': null}});
      expect(w.available, isFalse);
      expect(w.report, isNull);
    });

    test('never throws on a malformed body', () {
      expect(WeeklyReport.fromBody(const {}).available, isFalse);
      expect(WeeklyReport.fromBody({'data': 'nope'}).available, isFalse);
    });
  });
}
