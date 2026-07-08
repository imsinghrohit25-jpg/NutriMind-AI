import 'package:flutter_test/flutter_test.dart';
import 'package:nutrimind_grocery_providers/nutrimind_grocery_providers.dart';

void main() {
  group('groceryProviderFor', () {
    test('resolves IN to the India provider', () {
      expect(groceryProviderFor('IN').id, 'in_retail_avg');
      expect(groceryProviderFor('in').id, 'in_retail_avg'); // case-insensitive
    });

    test('resolves US to the US provider', () {
      expect(groceryProviderFor('US').currencyCode, 'USD');
    });

    test('resolves GB to the UK provider', () {
      expect(groceryProviderFor('GB').currencyCode, 'GBP');
    });

    test('falls back to India for an unregistered country', () {
      expect(groceryProviderFor('FR').id, 'in_retail_avg');
    });
  });

  group('currencySymbolFor', () {
    test('maps known currencies', () {
      expect(currencySymbolFor('INR'), '₹');
      expect(currencySymbolFor('USD'), '\$');
      expect(currencySymbolFor('GBP'), '£');
    });

    test('falls back to the raw code for unknown currencies', () {
      expect(currencySymbolFor('JPY'), 'JPY ');
    });
  });
}
