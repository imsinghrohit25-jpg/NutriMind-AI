# NutriMind AI — Grocery Cart Score Methodology

**Version:** 1.0.0  
**Effective:** 2026-07-07

---

## Cart score formula

The grocery cart health score is a **quantity-weighted average** of individual product health scores:

```
cart_score = Σ(product_score_i × quantity_i) / Σ(quantity_i)
```

Where `product_score_i` is the NutriMind health score (0–100) for product i, and `quantity_i` is the number of units of that product in the cart.

**Example — 8-item cart:**

| Product | Score | Qty | Weight | Contribution |
|---|---|---|---|---|
| Toor Dal 1kg | 85 | 2 | 2/14 = 0.143 | 12.1 |
| Brown Rice 5kg | 78 | 1 | 1/14 = 0.071 | 5.6 |
| Instant Noodles | 18 | 3 | 3/14 = 0.214 | 3.9 |
| Whole Milk 1L | 62 | 2 | 2/14 = 0.143 | 8.9 |
| Salted Chips 200g | 22 | 1 | 1/14 = 0.071 | 1.6 |
| Olive Oil 500ml | 71 | 1 | 1/14 = 0.071 | 5.1 |
| Whole Wheat Bread | 55 | 2 | 2/14 = 0.143 | 7.9 |
| Sugar 1kg | 30 | 2 | 2/14 = 0.143 | 4.3 |
| **Cart total** | | **14** | | **49.4 / 100** |

Cart band: Fair (40–59).

---

## Family rollup

When multiple household members are active, the family cart score is the equal-weighted average of each member's individual cart score. Each member's cart is evaluated independently because members may have different product exclusions (allergen profiles, diet preferences).

The rollup engine (`engines/cart/rollup.ts`) also:
1. Detects allergen conflicts between cart items and member allergen profiles
2. Flags unsuppressible conflicts (declared / trace allergens) as warnings that cannot be dismissed
3. Generates a summary of which products conflict with which members

---

## Nutritional projection

The cart projection (`engines/cart/projection.ts`) estimates the daily nutritional impact of the cart given usage frequencies. For each product:

```
daily_contribution_nutrient = (nutrient_per_100g / 100) × serving_g × (times_per_week / 7)
```

This helps users see how their grocery choices shape their average daily nutrition over the week, not just the nutritional content of individual products.

---

## Gap analysis

The daily gap report (`engines/meals/gap-analysis.ts`) compares actual consumed nutrients vs daily budget:

- **Under** (< 80% of budget) — shown for positive nutrients (fibre, protein) and calorific intake
- **On track** (80–110% of budget)
- **Over** (> 110% of budget) — shown for limiting nutrients (sodium, sugar, sat fat)

All budgets come from `engines/personalization/budgets.ts`, derived from Mifflin-St Jeor TDEE and ICMR-NIN 2020 RDA.
