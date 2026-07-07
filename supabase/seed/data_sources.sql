-- Seed: canonical data source registry
-- Every product/nutrition/ingredient row references one of these ids.
-- Do not delete rows; mark is_active = false to deprecate.

INSERT INTO public.data_sources (id, display_name, base_url, license_class, attribution_text, terms_url) VALUES

  ('openfoodfacts',
   'Open Food Facts',
   'https://world.openfoodfacts.org',
   'odbl',
   'Data from Open Food Facts (https://world.openfoodfacts.org), available under the Open Database License (ODbL). You are free to use the data as long as you attribute Open Food Facts and the contributors.',
   'https://world.openfoodfacts.org/terms-of-use'),

  ('usda_fdc',
   'USDA FoodData Central',
   'https://fdc.nal.usda.gov',
   'public_domain',
   'U.S. Department of Agriculture, Agricultural Research Service. FoodData Central (https://fdc.nal.usda.gov). Public domain — no attribution required, included for transparency.',
   'https://fdc.nal.usda.gov/help.html'),

  ('ifct_2017',
   'Indian Food Composition Tables 2017',
   NULL,
   'licensed_restricted',
   'Indian Food Composition Tables 2017. T. Longvah, R. Ananthan, K. Bhaskarachary and K. Venkaiah. National Institute of Nutrition, ICMR-NIN, Hyderabad, India. Used under license.',
   'https://www.nin.res.in/'),

  ('fssai_additives',
   'FSSAI Approved Food Additives',
   'https://www.fssai.gov.in',
   'public_domain',
   'Food Safety and Standards Authority of India (FSSAI). Food Additives database. Government of India, public domain.',
   'https://www.fssai.gov.in/regulations.php'),

  ('user_submitted',
   'User Submitted',
   NULL,
   'user_submitted',
   'Data submitted by NutriMind users. Not independently verified. Use with caution.',
   NULL),

  ('nutrimind_curated',
   'NutriMind Curated',
   NULL,
   'internal',
   'Data curated and verified by the NutriMind team from publicly available sources.',
   NULL)

ON CONFLICT (id) DO UPDATE SET
  display_name     = EXCLUDED.display_name,
  attribution_text = EXCLUDED.attribution_text,
  is_active        = true;
