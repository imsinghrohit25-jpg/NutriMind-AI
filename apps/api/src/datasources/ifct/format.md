# IFCT 2017 Dataset Format

**Source:** ICMR-National Institute of Nutrition, Hyderabad — Indian Food Composition Tables 2017.  
**License:** Licensed from ICMR-NIN. Not redistributable. Drop file at `data/ifct2017/ifct2017.csv`.  
**Acquisition:** https://www.nin.res.in — Risk R-01 (long lead time).

## Expected CSV Format

The parser (`parser.ts`) expects a UTF-8 CSV file with the following columns in this order.
Column headers are **required** and must match exactly (case-insensitive).

| Column | Type | Unit | Description |
|---|---|---|---|
| `food_code` | string | — | Unique IFCT food code (e.g. "A001") |
| `food_name_en` | string | — | English food name |
| `food_name_hi` | string | — | Hindi food name (may be empty) |
| `food_group` | string | — | Food group category |
| `moisture_g` | number | g/100g | Moisture content |
| `energy_kcal` | number | kcal/100g | Energy |
| `protein_g` | number | g/100g | Total protein |
| `fat_total_g` | number | g/100g | Total fat |
| `carbohydrates_g` | number | g/100g | Total carbohydrates (by difference) |
| `dietary_fiber_g` | number | g/100g | Total dietary fibre |
| `sugars_g` | number | g/100g | Total sugars (may be empty for some entries) |
| `ash_g` | number | g/100g | Total ash |
| `calcium_mg` | number | mg/100g | Calcium |
| `phosphorus_mg` | number | mg/100g | Phosphorus |
| `iron_mg` | number | mg/100g | Iron |
| `sodium_mg` | number | mg/100g | Sodium |
| `potassium_mg` | number | mg/100g | Potassium |
| `zinc_mg` | number | mg/100g | Zinc |
| `vitamin_c_mg` | number | mg/100g | Vitamin C (total ascorbic acid) |
| `beta_carotene_mcg` | number | mcg/100g | Beta-carotene (provitamin A) |
| `thiamine_mg` | number | mg/100g | Thiamine (B1) |
| `riboflavin_mg` | number | mg/100g | Riboflavin (B2) |
| `niacin_mg` | number | mg/100g | Niacin (B3) |
| `folate_mcg` | number | mcg/100g | Total folate |
| `vitamin_b12_mcg` | number | mcg/100g | Vitamin B12 (0 for plant foods) |
| `cholesterol_mg` | number | mg/100g | Cholesterol (0 for plant foods) |

## Notes

- Empty cells are treated as `null` (nutrient not measured for that food).
- Rows with missing `food_code` or `food_name_en` are skipped.
- Beta-carotene → Vitamin A IU conversion: 1 mcg beta-carotene = 0.167 mcg RAE = 0.556 IU
  (WHO/IVACG recommendations; provitamin A bioactivity factor 6:1).
- `added_sugars_g` is not in the IFCT dataset; the estimation rule from ADR-0007 applies
  (total sugars used as conservative upper bound, `sugars_added_estimated = true`).
- Energy validation: Atwater consistency check runs at normalisation time; deviations > 10%
  produce a note in the `notes` field but the IFCT reported value is used.

## File placement

```
data/
  ifct2017/
    ifct2017.csv      ← required (gitignored — licensed content)
    README.md         ← acquisition instructions
```
