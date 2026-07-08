/// NutriMind Grocery Providers — country grocery price provider metadata (Phase 5).
/// Price estimation is server-side, single-source-of-truth (ADR-0018 §1); this package
/// provides display metadata (currency, provider name) only.
///
/// The OFF/USDA Branded/LocalCatalog product-data-source abstraction described in this
/// package's original scope is a distinct, larger concern (product catalog sourcing, not
/// shopping-list price estimation) and remains future work.
library nutrimind_grocery_providers;

export 'src/grocery_provider_info.dart';
