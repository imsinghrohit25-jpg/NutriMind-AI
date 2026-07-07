-- Seed: allergen taxonomy
-- Based on FSSAI Food Safety and Standards (Labelling and Display) Regulations 2020
-- and international classification (EU 14 major allergens + India-specific additions).
-- is_major = true: mandatory declaration on Indian packaged foods per FSSAI.

-- Root-level allergens first (no parent)
INSERT INTO public.allergen_taxonomy
  (id, display_name, fssai_category, aliases, parent_allergen_id, description, is_major)
VALUES

  ('gluten',
   'Cereals containing gluten',
   'Cereals containing gluten',
   ARRAY['wheat','barley','rye','oats','spelt','kamut','triticale','atta','maida','semolina','suji'],
   NULL,
   'Wheat, barley, rye, oats, spelt and their hybridised strains. Key concern for celiac disease and wheat allergy.',
   true),

  ('crustaceans',
   'Crustaceans and crustacean products',
   'Crustaceans',
   ARRAY['shrimp','prawn','crab','lobster','crawfish','krill','jhinga','chingri'],
   NULL,
   'Shrimps, prawns, crabs, lobsters and similar shellfish.',
   true),

  ('eggs',
   'Eggs and egg products',
   'Eggs',
   ARRAY['egg','egg white','egg yolk','albumin','mayonnaise','lecithin (egg)','anda'],
   NULL,
   'Eggs from poultry and products derived from eggs.',
   true),

  ('fish',
   'Fish and fish products',
   'Fish',
   ARRAY['fish','anchovy','bass','cod','haddock','herring','mackerel','mahi','salmon','sardine',
         'tilapia','tuna','rohu','katla','pomfret','surmai'],
   NULL,
   'All fish species and derived products.',
   true),

  ('peanuts',
   'Peanuts and peanut products',
   'Peanuts',
   ARRAY['peanut','groundnut','monkey nut','mungfali','moongphali','arachis oil'],
   NULL,
   'Peanuts (groundnuts) and all derived products including oils unless fully refined.',
   true),

  ('soybeans',
   'Soybeans and soy products',
   'Soybeans',
   ARRAY['soy','soya','tofu','tempeh','miso','edamame','soy sauce','tamari','soy protein','soy lecithin'],
   NULL,
   'Soybeans and derived products. Common hidden source in processed foods.',
   true),

  ('milk',
   'Milk and milk products',
   'Milk',
   ARRAY['milk','dairy','lactose','whey','casein','butter','ghee','cream','cheese','yogurt',
         'curd','paneer','dahi','khoa','mawa','lactalbumin','lactoglobulin'],
   NULL,
   'Cow milk and milk from other mammals and derived products.',
   true),

  ('tree_nuts',
   'Tree nuts',
   'Tree nuts',
   ARRAY['nut','almond','cashew','hazelnut','pecan','pistachio','walnut','macadamia',
         'brazil nut','pine nut','chestnut','badam','kaju','akhrot','pista'],
   NULL,
   'Tree nuts including almonds, cashews, hazelnuts, walnuts, pecans, pistachios and others.',
   true),

  ('celery',
   'Celery and celery products',
   'Celery',
   ARRAY['celery','celeriac','celery seed','celery salt'],
   NULL,
   'Celery stalks, leaves, seeds and celeriac.',
   false),

  ('mustard',
   'Mustard and mustard products',
   'Mustard',
   ARRAY['mustard','mustard seed','mustard oil','sarson','rai','mustard flour','mustard leaves'],
   NULL,
   'Mustard plant seeds, leaves, oil and derived products.',
   true),

  ('sesame',
   'Sesame seeds and sesame products',
   'Sesame',
   ARRAY['sesame','sesame seed','sesame oil','til','tahini','gingelly','til oil'],
   NULL,
   'Sesame seeds and derived products including oil and paste (tahini).',
   true),

  ('sulphites',
   'Sulphur dioxide and sulphites',
   'Sulphites',
   ARRAY['sulphur dioxide','sulfur dioxide','sodium sulphite','sodium bisulphite',
         'potassium bisulphite','sodium metabisulphite','potassium metabisulphite',
         'INS 220','INS 221','INS 222','INS 223','INS 224','INS 225','INS 228'],
   NULL,
   'Sulphur dioxide and sulphites at concentrations more than 10 mg/kg as total SO2.',
   true),

  ('lupin',
   'Lupin and lupin products',
   NULL,
   ARRAY['lupin','lupine','lupin flour','lupin seed'],
   NULL,
   'Lupin seeds and flour. May cross-react with peanut allergy.',
   false),

  ('molluscs',
   'Molluscs and mollusc products',
   NULL,
   ARRAY['clam','mussel','oyster','scallop','squid','octopus','snail','abalone'],
   NULL,
   'Molluscs including clams, mussels, oysters, squid and others.',
   false)

ON CONFLICT (id) DO UPDATE SET
  display_name   = EXCLUDED.display_name,
  aliases        = EXCLUDED.aliases,
  description    = EXCLUDED.description,
  is_major       = EXCLUDED.is_major;

-- Sub-allergens (tree nut children) — inserted after parents
INSERT INTO public.allergen_taxonomy
  (id, display_name, fssai_category, aliases, parent_allergen_id, is_major)
VALUES
  ('almonds',    'Almonds',     'Tree nuts', ARRAY['almond','badam'],              'tree_nuts', true),
  ('cashews',    'Cashews',     'Tree nuts', ARRAY['cashew','kaju','cashew nut'],  'tree_nuts', true),
  ('hazelnuts',  'Hazelnuts',   'Tree nuts', ARRAY['hazelnut','cobnut','filbert'], 'tree_nuts', true),
  ('walnuts',    'Walnuts',     'Tree nuts', ARRAY['walnut','akhrot'],             'tree_nuts', true),
  ('pistachios', 'Pistachios',  'Tree nuts', ARRAY['pistachio','pista'],           'tree_nuts', true),
  ('pecans',     'Pecans',      'Tree nuts', ARRAY['pecan'],                       'tree_nuts', false),
  ('macadamia',  'Macadamia',   'Tree nuts', ARRAY['macadamia','queensland nut'],  'tree_nuts', false),
  ('brazil_nuts','Brazil nuts', 'Tree nuts', ARRAY['brazil nut','para nut'],       'tree_nuts', false)
ON CONFLICT (id) DO NOTHING;
