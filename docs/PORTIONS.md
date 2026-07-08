# Indian Portion Sizes Reference

This document defines the standard portion sizes used by NutriMind's voice logging,
meal planner, and recipe generator when a user specifies a food without an explicit gram weight.

## Portion Unit Definitions

| Unit       | Grams (approx.) | Notes                                     |
|-----------|----------------|-------------------------------------------|
| katori     | 150 g          | Standard steel katori (serving bowl)      |
| bowl       | 200 g          | Larger serving bowl                       |
| roti       | 30 g           | 1 medium phulka/chapati (6-inch diameter) |
| paratha    | 60 g           | 1 plain paratha (stuffed: 80-120 g)       |
| glass      | 240 ml         | Standard 240ml glass                      |
| cup        | 240 ml         | US cup equivalent                         |
| plate      | 350 g          | Steel thali meal (estimated average)      |
| piece      | varies         | Context-dependent; falls back to 100 g    |
| ladoo      | 40 g           | Standard ladoo/laddoo                     |
| idli       | 35 g           | 1 standard idli                           |
| dosa       | 60 g           | 1 plain dosa (masala dosa: 120 g)         |
| samosa     | 60 g           | 1 standard samosa                         |
| puri       | 20 g           | 1 small puri                              |

## Indian Dish Default Portions (Voice Logging)

When a user says "I had dal" without specifying a quantity, NutriMind defaults to:

| Food Item         | Default Portion | Unit     |
|------------------|----------------|----------|
| Dal (any)         | 150 g          | 1 katori |
| Sabzi (any)       | 150 g          | 1 katori |
| Chawal / Rice     | 150 g cooked   | 1 katori |
| Roti / Chapati    | 60 g           | 2 rotis  |
| Paratha           | 60 g           | 1 piece  |
| Khichdi           | 200 g          | 1 bowl   |
| Curd / Dahi       | 100 g          | 1 katori |
| Raita             | 100 g          | 1 katori |
| Biryani           | 250 g          | 1 plate  |
| Idli              | 70 g           | 2 idlis  |
| Dosa              | 60 g           | 1 piece  |
| Sambar            | 100 ml         | 1 cup    |
| Chai (tea)        | 150 ml         | 1 cup    |
| Milk              | 240 ml         | 1 glass  |
| Fruits (whole)    | 100 g          | 1 piece  |
| Namkeen / Snacks  | 30 g           | 1 small bowl |

## Portion Uncertainty Handling

If the user's utterance is ambiguous:
1. Use the default portion from this table.
2. Include a UI prompt: "Was that [N] [unit]? Adjust if needed."
3. Log the uncertainty in the voice NLU result (`confidence` < 0.7).

## References

- ICMR Dietary Guidelines for Indians (2024)
- NIN (National Institute of Nutrition) portion size guide
- NutriMind IFCT integration — actual nutrient values per gram from IFCT 2017
