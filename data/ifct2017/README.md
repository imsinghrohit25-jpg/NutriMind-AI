# IFCT 2017 Dataset — Acquisition Instructions

**Status:** Dataset required. File not present (acquisition pending — Risk R-01).

## What is needed

Place the IFCT 2017 CSV file at:
```
data/ifct2017/ifct2017.csv
```

The expected CSV format is documented in:
```
apps/api/src/datasources/ifct/format.md
```

## How to obtain

1. Contact ICMR-National Institute of Nutrition (NIN), Hyderabad
2. Website: https://www.nin.res.in
3. Purchase or license the IFCT 2017 publication + data tables
4. Convert to the CSV format documented in `format.md`
5. Record the license terms in `data_sources` table row `ifct_2017`

## License

The IFCT 2017 dataset is licensed from ICMR-NIN and is **not redistributable**.
This directory (`data/ifct2017/`) is gitignored to prevent accidental commits.

## Impact of absence

Without this file:
- The IFCT resolution step is skipped (waterfall degrades to OFF → USDA)
- Indian whole foods (dal, sabzi, regional dishes) will return USDA or OFF data where available
- The Phase 3 gate test "real IFCT food returns IFCT values" will be blocked

The server **starts normally** without the file — no crash. A warning is logged:
```
[ifct] IFCT 2017 dataset not loaded — IFCT resolution step will be skipped
```
