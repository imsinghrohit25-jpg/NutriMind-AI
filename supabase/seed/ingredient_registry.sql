-- Seed: common ingredient/additive registry
-- Covers the most frequent INS-numbered additives on Indian packaged food labels.
-- Source: FSSAI Schedule 5 permitted food additives + JECFA/EFSA evaluations.
-- Expanded incrementally; Phase 3 adds the full IFCT natural ingredient list.

INSERT INTO public.ingredients
  (name, common_names, ins_number, category, allergen_classes,
   is_vegan, is_vegetarian, is_jain,
   fssai_status, efsa_status, jecfa_status,
   safety_summary, citation_url,
   source, source_id, dataset_version, license_class)
VALUES

  -- Preservatives
  ('Sodium Benzoate',
   ARRAY['benzoate of soda','E211'],
   'INS 211', 'additive', ARRAY[]::TEXT[],
   true, true, true,
   'permitted', 'approved', 'acceptable',
   'Permitted preservative. ADI 0–5 mg/kg bw/day (JECFA). Avoid in beverages with ascorbic acid — may form benzene.',
   'https://www.who.int/foodsafety/publications/jecfa-annualreport/en/',
   'fssai_additives', 'INS211', '2023', 'public_domain'),

  ('Potassium Sorbate',
   ARRAY['sorbate','E202'],
   'INS 202', 'additive', ARRAY[]::TEXT[],
   true, true, true,
   'permitted', 'approved', 'acceptable',
   'Widely used antifungal preservative. ADI 0–25 mg/kg bw/day. Generally recognised as safe at permitted levels.',
   'https://efsa.onlinelibrary.wiley.com/doi/10.2903/j.efsa.2015.4144',
   'fssai_additives', 'INS202', '2023', 'public_domain'),

  ('Sodium Nitrite',
   ARRAY['nitrite','curing salt','E250'],
   'INS 250', 'additive', ARRAY[]::TEXT[],
   false, false, false,
   'restricted', 'approved_with_limits', 'acceptable',
   'Meat preservative and colour fixative. ADI 0–0.07 mg/kg bw/day. Not permitted in foods for infants/young children. May form nitrosamines at high heat.',
   'https://www.who.int/foodsafety/publications/jecfa-annualreport/en/',
   'fssai_additives', 'INS250', '2023', 'public_domain'),

  -- Sweeteners
  ('Aspartame',
   ARRAY['NutraSweet','Equal','E951'],
   'INS 951', 'additive', ARRAY[]::TEXT[],
   true, true, true,
   'permitted', 'approved', 'acceptable',
   'Intense sweetener. ADI 0–40 mg/kg bw/day. Contains phenylalanine — contraindicated in phenylketonuria (PKU). IARC 2B (possibly carcinogenic) based on limited evidence; regulatory bodies maintain safety at ADI.',
   'https://www.who.int/news/item/14-07-2023-aspartame-hazard-and-risk-assessment-results-released',
   'fssai_additives', 'INS951', '2023', 'public_domain'),

  ('Acesulfame Potassium',
   ARRAY['Acesulfame K','Ace-K','E950'],
   'INS 950', 'additive', ARRAY[]::TEXT[],
   true, true, true,
   'permitted', 'approved', 'acceptable',
   'Intense sweetener, ~200x sweeter than sugar. ADI 0–15 mg/kg bw/day. Heat-stable; frequently combined with other sweeteners.',
   'https://efsa.onlinelibrary.wiley.com/doi/10.2903/j.efsa.2021.6330',
   'fssai_additives', 'INS950', '2023', 'public_domain'),

  ('Sucralose',
   ARRAY['Splenda','E955'],
   'INS 955', 'additive', ARRAY[]::TEXT[],
   true, true, true,
   'permitted', 'approved', 'acceptable',
   'Chlorinated sucrose derivative, ~600x sweeter than sugar. ADI 0–15 mg/kg bw/day. Heat-stable.',
   'https://efsa.onlinelibrary.wiley.com/doi/10.2903/j.efsa.2017.4659',
   'fssai_additives', 'INS955', '2023', 'public_domain'),

  -- Emulsifiers / Stabilisers
  ('Soy Lecithin',
   ARRAY['lecithin','E322','soya lecithin'],
   'INS 322', 'additive', ARRAY['soybeans'],
   true, true, true,
   'permitted', 'approved', 'acceptable',
   'Emulsifier derived from soy. Allergen note: may contain soy protein traces; declare for soy-allergic individuals.',
   'https://www.efsa.europa.eu/en/efsajournal/pub/4786',
   'fssai_additives', 'INS322', '2023', 'public_domain'),

  ('Mono- and diglycerides of fatty acids',
   ARRAY['DATEM','E471','mono diglycerides'],
   'INS 471', 'additive', ARRAY[]::TEXT[],
   true, true, false,
   'permitted', 'approved', 'acceptable',
   'Common emulsifier. May be derived from animal or vegetable fats — source determines vegetarian/vegan suitability. Jain note: may contain animal-origin fats.',
   'https://www.fssai.gov.in',
   'fssai_additives', 'INS471', '2023', 'public_domain'),

  -- Colours
  ('Sunset Yellow FCF',
   ARRAY['Yellow 6','Orange Yellow S','E110'],
   'INS 110', 'additive', ARRAY[]::TEXT[],
   true, true, true,
   'permitted', 'approved_with_limits', 'acceptable',
   'Synthetic azo dye. ADI 0–4 mg/kg bw/day. Associated with hyperactivity in children at high doses (McCann et al., 2007); EU requires advisory label "may have an adverse effect on activity and attention in children".',
   'https://efsa.onlinelibrary.wiley.com/doi/10.2903/j.efsa.2009.1330',
   'fssai_additives', 'INS110', '2023', 'public_domain'),

  ('Tartrazine',
   ARRAY['Yellow 5','E102','FD&C Yellow 5'],
   'INS 102', 'additive', ARRAY[]::TEXT[],
   true, true, true,
   'permitted', 'approved_with_limits', 'acceptable',
   'Synthetic azo dye. ADI 0–7.5 mg/kg bw/day. May cause allergic reactions in aspirin-sensitive individuals. EU hyperactivity advisory label required.',
   'https://efsa.onlinelibrary.wiley.com/doi/10.2903/j.efsa.2009.1331',
   'fssai_additives', 'INS102', '2023', 'public_domain'),

  -- Antioxidants
  ('Butylated Hydroxyanisole',
   ARRAY['BHA','E320'],
   'INS 320', 'additive', ARRAY[]::TEXT[],
   true, true, true,
   'restricted', 'approved_with_limits', 'acceptable',
   'Fat-soluble antioxidant. ADI 0–0.5 mg/kg bw/day. Potential endocrine-disrupting properties under research; IARC Group 2B.',
   'https://monographs.iarc.who.int/wp-content/uploads/2018/06/mono40-5.pdf',
   'fssai_additives', 'INS320', '2023', 'public_domain'),

  -- Flavour enhancers
  ('Monosodium Glutamate',
   ARRAY['MSG','Ajinomoto','E621','aji-no-moto'],
   'INS 621', 'additive', ARRAY[]::TEXT[],
   true, true, true,
   'permitted', 'approved', 'acceptable',
   'Umami flavour enhancer. ADI "not specified" (JECFA — safe at normal dietary levels). Anecdotal "MSG symptom complex" not supported by controlled trials.',
   'https://www.who.int/publications/i/item/who-food-additives-series-22',
   'fssai_additives', 'INS621', '2023', 'public_domain'),

  -- Thickeners / Stabilisers
  ('Carrageenan',
   ARRAY['E407','Irish moss extract'],
   'INS 407', 'additive', ARRAY[]::TEXT[],
   true, true, true,
   'permitted', 'approved', 'acceptable',
   'Seaweed-derived thickener. ADI "not specified" (JECFA). Degraded carrageenan (poligeenan) is inflammatory; food-grade carrageenan is distinct. Controversy ongoing — some researchers flag concern at high doses.',
   'https://efsa.onlinelibrary.wiley.com/doi/10.2903/j.efsa.2018.5238',
   'fssai_additives', 'INS407', '2023', 'public_domain'),

  ('Xanthan Gum',
   ARRAY['E415','xanthan'],
   'INS 415', 'additive', ARRAY[]::TEXT[],
   true, true, true,
   'permitted', 'approved', 'acceptable',
   'Fermentation-derived polysaccharide thickener. ADI "not specified" (JECFA). Well-tolerated; used in gluten-free products.',
   'https://www.who.int/publications/i/item/who-food-additives-series-17',
   'fssai_additives', 'INS415', '2023', 'public_domain'),

  -- Acids
  ('Citric Acid',
   ARRAY['E330','lemon salt'],
   'INS 330', 'additive', ARRAY[]::TEXT[],
   true, true, true,
   'permitted', 'approved', 'acceptable',
   'Natural acid and acidulant. ADI "not specified" (JECFA). Widely considered safe at food-use levels.',
   'https://www.who.int/publications/i/item/who-food-additives-series-5',
   'fssai_additives', 'INS330', '2023', 'public_domain'),

  -- Palm oil (common in Indian packaged foods; not an additive but important for NOVA/diet)
  ('Palm Oil',
   ARRAY['palmolein','RBD palm oil','vegetable oil (palm)'],
   NULL, 'whole_food', ARRAY[]::TEXT[],
   true, true, true,
   'permitted', NULL, NULL,
   'High in saturated fat (palmitic acid ~44%). NOVA group 1 when unprocessed. Presence in packaged food often indicates NOVA 3/4 processing.',
   NULL,
   'nutrimind_curated', 'palm_oil', '1.0', 'internal'),

  -- Common Indian spice blends / whole ingredients
  ('Turmeric',
   ARRAY['haldi','curcumin','E100','Curcuma longa'],
   'INS 100', 'additive', ARRAY[]::TEXT[],
   true, true, true,
   'permitted', 'approved', 'acceptable',
   'Natural yellow colourant and spice. Curcumin (active compound) has anti-inflammatory properties studied in clinical research. ADI 0–3 mg/kg bw/day for curcumin extract.',
   'https://efsa.onlinelibrary.wiley.com/doi/10.2903/j.efsa.2010.1679',
   'nutrimind_curated', 'turmeric', '1.0', 'internal')

ON CONFLICT DO NOTHING;
