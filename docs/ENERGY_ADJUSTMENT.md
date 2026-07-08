# Energy Adjustment Model

NutriMind adjusts a user's daily calorie budget upward when their measured active energy
(from a wearable) meaningfully exceeds what their configured TDEE already accounts for.

## Motivation

TDEE (Total Daily Energy Expenditure) is computed from BMR × Activity Factor. The activity
factor already assumes a baseline level of movement. On days where the user exercises
significantly more than their baseline, their actual expenditure is higher — and eating
at the original target would put them into an unintended deficit.

Conversely, blindly "eating back" all exercise calories ignores metabolic compensation
(the body partly reduces other energy expenditure in response to exercise).

## Algorithm

```
expected_active_kcal = TDEE × (1 - 1/activity_factor)
excess_kcal          = measured_active_kcal - expected_active_kcal
adjustment_kcal      = min(floor(excess_kcal × 0.50), 500)
adjusted_budget      = TDEE + adjustment_kcal   (if excess_kcal ≥ 100)
```

### Activity Factor Table

| Activity Level | Factor | Expected Active Fraction |
|---------------|--------|--------------------------|
| Sedentary     | 1.200  | 16.7%                    |
| Light         | 1.375  | 27.3%                    |
| Moderate      | 1.550  | 35.5%                    |
| Active        | 1.725  | 42.0%                    |
| Very Active   | 1.900  | 47.4%                    |

### Parameters

| Parameter            | Value | Rationale                                      |
|---------------------|-------|------------------------------------------------|
| Compensation Rate   | 50%   | Practical midpoint; evidence below             |
| Maximum Adjustment  | +500 kcal | Safety bound; prevents extreme over-eating |
| Minimum Excess      | 100 kcal  | Avoids noise from minor activity variations |

## Evidence Base

### Compensation Rate = 50%

Pontzer et al. (2016) demonstrated that sedentary adults increased in total energy
expenditure by ~30% of the energy cost of imposed activity. Moderate exercisers saw
less compensation (~20%). We use 50% as a conservative-but-practical midpoint:

- **Too low (e.g., 0%):** Creates perpetual deficit on active days → unsustainable
- **Too high (e.g., 100%):** "Eat back everything" ignores compensation → stalls weight goals
- **50%:** Supported athletes achieving modest deficits while fuelling performance

### Maximum +500 kcal Safety Bound

Donnelly et al. (2009) ACSM position stand recommends structured exercise programs
burning 250–500 kcal/session. A 500 kcal ceiling covers the upper end of typical
single-session expenditure without permitting pathological eat-back.

### Minimum 100 kcal Threshold

Below 100 kcal excess, the signal is within sensor noise for most wearables (Fitbit
reports ±5–10% accuracy for active energy). Adjustments below this threshold would
be spurious.

## Citations

1. **Hall KD, Sacks G, Chandramohan D et al.** (2011). Quantification of the effect of
   energy imbalance on bodyweight. *The Lancet* 378(9793): 826–837.
   https://doi.org/10.1016/S0140-6736(11)60812-X

2. **Pontzer H, Durazo-Arvizu R, Dugas LR et al.** (2016). Constrained Total Energy
   Expenditure and Metabolic Adaptation to Physical Activity in Adult Humans.
   *Current Biology* 26(3): 410–417.
   https://doi.org/10.1016/j.cub.2015.12.046

3. **Donnelly JE, Blair SN, Jakicic JM et al.** (2009). American College of Sports
   Medicine Position Stand: Appropriate Physical Activity Intervention Strategies
   for Weight Loss and Prevention of Weight Regain for Adults.
   *Medicine & Science in Sports & Exercise* 41(2): 459–471.
   https://doi.org/10.1249/MSS.0b013e3181949333

## Implementation

- **Engine:** `apps/api/src/health/energy-adjustment.ts` — pure deterministic function, no LLM
- **Test:** `apps/api/src/health/__tests__/energy-adjustment.test.ts`
- **API:** `GET /api/v1/health/energy-adjustment?tdee=2000&activityLevel=moderate`
- **UI:** `apps/mobile/lib/features/health/energy_adjustment_card.dart`

## Invariants (enforced by tests)

- Compensation rate is always exactly 0.50 (never changes per request)
- Adjustment is always ≤ 500 kcal
- No adjustment applied when excess < 100 kcal
- Output is deterministic for same inputs (no randomness, no LLM)
- All citations present in output when adjustment is non-zero
