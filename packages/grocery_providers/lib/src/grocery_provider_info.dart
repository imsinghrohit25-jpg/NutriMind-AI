/// Display metadata for a country grocery price provider — mirrors the `displayName`,
/// `currencyCode`, and `isoCountryCodes` fields of the TypeScript `GroceryPriceProvider`
/// packs in `apps/api/src/planner/grocery-providers/*.ts`. Metadata only: price estimation
/// itself stays server-side (`buildGroceryList()`), same single-source-of-truth pattern as
/// `nutrimind_nutrition_rules` (ADR-0017 §5, ADR-0018 §1).
class GroceryProviderInfo {
  const GroceryProviderInfo({
    required this.id,
    required this.displayName,
    required this.currencyCode,
    required this.isoCountryCodes,
  });

  final String id;
  final String displayName;
  final String currencyCode;
  final List<String> isoCountryCodes;
}

const _knownProviders = <GroceryProviderInfo>[
  GroceryProviderInfo(
    id: 'in_retail_avg',
    displayName: 'India — approximate retail average',
    currencyCode: 'INR',
    isoCountryCodes: ['IN'],
  ),
  GroceryProviderInfo(
    id: 'us_retail_avg',
    displayName: 'United States — approximate retail average',
    currencyCode: 'USD',
    isoCountryCodes: ['US'],
  ),
  GroceryProviderInfo(
    id: 'uk_retail_avg',
    displayName: 'United Kingdom — approximate retail average',
    currencyCode: 'GBP',
    isoCountryCodes: ['GB'],
  ),
];

/// Look up provider metadata by ISO country code. Falls back to the India provider,
/// matching the server-side `getGroceryProvider()` default (ADR-0018 §1).
GroceryProviderInfo groceryProviderFor(String isoCode) {
  final iso = isoCode.toUpperCase();
  return _knownProviders.firstWhere(
    (p) => p.isoCountryCodes.contains(iso),
    orElse: () => _knownProviders.first, // India — same default as the server registry
  );
}

/// Minimal currency symbol lookup for the currently-registered provider currencies.
/// Falls back to the ISO code itself (with a trailing space) for anything unmapped.
String currencySymbolFor(String currencyCode) {
  const symbols = {'INR': '₹', 'USD': '\$', 'GBP': '£'};
  return symbols[currencyCode] ?? '$currencyCode ';
}
