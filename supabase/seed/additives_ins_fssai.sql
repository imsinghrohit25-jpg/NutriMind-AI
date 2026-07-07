-- Additive knowledge base — INS numbers with FSSAI permitted status and safety context.
-- Source: FSSAI Food Safety and Standards (Food Products Standards and Food Additives) Regulations 2011
--         and subsequent amendments; INS numbering per Codex Alimentarius CAC/GL 36.
-- This data is used to show per-ingredient safety information in the app.
-- IMPORTANT: Notes are informational only — NutriMind does not provide medical advice.

CREATE TABLE IF NOT EXISTS additives_ins (
  ins_number   TEXT PRIMARY KEY,            -- e.g. 'E211', 'INS 211'
  name         TEXT NOT NULL,               -- common name
  fssai_permitted BOOLEAN NOT NULL DEFAULT true,
  category     TEXT NOT NULL,               -- colour, preservative, antioxidant, etc.
  nova_signal  BOOLEAN NOT NULL DEFAULT false, -- true if this INS signals NOVA 4
  safety_note  TEXT NOT NULL,               -- plain language, non-medical
  citation     TEXT NOT NULL                -- regulatory citation
);

INSERT INTO additives_ins (ins_number, name, fssai_permitted, category, nova_signal, safety_note, citation) VALUES

-- ── Colours ──────────────────────────────────────────────────────────────────
('E102',  'Tartrazine (Yellow 5)',       true,  'colour',      true,
 'Artificial yellow dye. FSSAI permits in select processed foods. Some individuals with aspirin sensitivity may be sensitive to tartrazine. Not permitted in infant foods.',
 'FSSAI Reg 2011 Schedule I, Part II; EFSA Opinion 2009'),

('E110',  'Sunset Yellow FCF',           true,  'colour',      true,
 'Artificial orange-yellow dye. FSSAI-permitted in limited food categories. Part of the "Southampton Six" colours studied for hyperactivity in children.',
 'FSSAI Reg 2011; EFSA Scientific Opinion on the "Southampton Six" (2009)'),

('E122',  'Carmoisine (Azorubine)',       true,  'colour',      true,
 'Artificial red dye. Part of the "Southampton Six" colours. FSSAI-permitted in specific food categories.',
 'FSSAI Reg 2011; EFSA 2009'),

('E129',  'Allura Red AC (Red 40)',       true,  'colour',      true,
 'Widely used artificial red dye. Included in Southampton Six study. FSSAI-permitted in processed foods and beverages.',
 'FSSAI Reg 2011; EFSA 2009'),

('E133',  'Brilliant Blue FCF',           true,  'colour',      true,
 'Artificial blue dye. Generally regarded as safe at permitted levels. FSSAI-permitted in select categories.',
 'FSSAI Reg 2011; Codex Alimentarius'),

-- ── Preservatives ─────────────────────────────────────────────────────────────
('E200',  'Sorbic acid',                  true,  'preservative', true,
 'Natural-source preservative. Generally considered safe at FSSAI-permitted levels. Prevents mould in baked goods, dairy, and beverages.',
 'FSSAI Reg 2011; WHO/FAO JECFA Evaluation'),

('E211',  'Sodium benzoate',              true,  'preservative', true,
 'Common preservative in soft drinks and jams. Can form benzene when combined with ascorbic acid (Vitamin C) under heat or light; levels in food are typically well below safety thresholds. FSSAI-permitted at specified limits.',
 'FSSAI Reg 2011; WHO/FAO JECFA 2000; FDA CPG Sec 555.425'),

('E212',  'Potassium benzoate',           true,  'preservative', true,
 'Preservative with similar profile to sodium benzoate. FSSAI-permitted in specified food categories.',
 'FSSAI Reg 2011; Codex Alimentarius'),

('E221',  'Sodium sulphite',              true,  'preservative', true,
 'Sulphite preservative. Can trigger reactions in sulphite-sensitive individuals; must be declared on label when present above 10 mg/kg. FSSAI-permitted.',
 'FSSAI Reg 2011; EFSA ANS Panel 2016'),

-- ── Antioxidants ──────────────────────────────────────────────────────────────
('E320',  'Butylated hydroxyanisole (BHA)', true, 'antioxidant',  true,
 'Synthetic antioxidant used to prevent fat rancidity. FSSAI-permitted at low levels in specified fat-containing foods. Listed as "possibly carcinogenic to humans" (Group 2B) by IARC at very high doses in animal studies; dietary exposure from permitted uses is far below these levels.',
 'FSSAI Reg 2011; IARC Monographs Vol 40 (1986); EFSA 2012'),

('E321',  'Butylated hydroxytoluene (BHT)', true, 'antioxidant',  true,
 'Synthetic antioxidant. Similar to BHA. FSSAI-permitted at trace levels in fats, oils, and fat-containing foods.',
 'FSSAI Reg 2011; EFSA 2012'),

-- ── Thickeners / Stabilisers ──────────────────────────────────────────────────
('E407',  'Carrageenan',                   true,  'thickener',   true,
 'Derived from red seaweed. Used in dairy desserts and plant milks. Generally recognised as safe (GRAS) by USFDA; some animal studies raised concerns at degraded forms not used in food. FSSAI-permitted.',
 'FSSAI Reg 2011; USFDA GRAS Notice GRN 541; EFSA 2018'),

('E412',  'Guar gum',                      true,  'thickener',   false,
 'Natural polysaccharide from guar beans, grown widely in Rajasthan. Generally recognised as safe. High fibre content.',
 'FSSAI Reg 2011; Codex Alimentarius'),

('E415',  'Xanthan gum',                   true,  'thickener',   true,
 'Fermentation-derived polysaccharide. Considered safe at permitted levels. Used in gluten-free products and dressings.',
 'FSSAI Reg 2011; Codex Alimentarius; EFSA 2017'),

('E460',  'Microcrystalline cellulose',    true,  'thickener',   true,
 'Purified plant cellulose used as anti-caking agent and bulking agent. Considered safe by FSSAI and Codex.',
 'FSSAI Reg 2011; Codex Alimentarius CAC/GL 36'),

-- ── Emulsifiers ───────────────────────────────────────────────────────────────
('E471',  'Mono- and diglycerides of fatty acids', true, 'emulsifier', true,
 'Derived from fats (animal or vegetable). Widely used in bakery, margarine, and ice cream. FSSAI-permitted. Vegetarians/vegans should check source.',
 'FSSAI Reg 2011; EFSA 2017'),

('E472',  'Esters of mono- and diglycerides', true, 'emulsifier', true,
 'Family of emulsifiers derived from fatty acids. FSSAI-permitted in processed foods. Vegetarians/vegans should check source.',
 'FSSAI Reg 2011; Codex Alimentarius'),

('E481',  'Sodium stearoyl lactylate (SSL)', true, 'emulsifier', true,
 'Used as a dough conditioner in bread and bakery products. Derived from lactic acid and stearic acid. FSSAI-permitted.',
 'FSSAI Reg 2011; EFSA 2012'),

('E482',  'Calcium stearoyl lactylate (CSL)', true, 'emulsifier', true,
 'Similar to SSL; used in bread making and whipped products. FSSAI-permitted.',
 'FSSAI Reg 2011; EFSA 2012'),

-- ── Flavour Enhancers ─────────────────────────────────────────────────────────
('E621',  'Monosodium glutamate (MSG)',    true,  'flavour_enhancer', true,
 'Umami flavour enhancer. FSSAI-permitted in specified categories. Extensive review by EFSA (2017) and WHO/FAO JECFA found no credible evidence of harm at dietary intake levels. "Chinese Restaurant Syndrome" claims have not been substantiated in controlled studies.',
 'FSSAI Reg 2011; EFSA ANS Panel 2017; WHO/FAO JECFA Eval No 31'),

('E627',  'Disodium guanylate',            true,  'flavour_enhancer', true,
 'Flavour enhancer often used with MSG to amplify umami taste. Derived from fish or yeast — not suitable for strict vegetarians. FSSAI-permitted.',
 'FSSAI Reg 2011; Codex Alimentarius'),

('E631',  'Disodium inosinate',            true,  'flavour_enhancer', true,
 'Flavour enhancer often used with MSG. Usually derived from meat or fish — not suitable for vegetarians. FSSAI-permitted.',
 'FSSAI Reg 2011; Codex Alimentarius'),

-- ── Artificial Sweeteners ─────────────────────────────────────────────────────
('E951',  'Aspartame',                     true,  'sweetener',   true,
 'High-intensity sweetener, ~200× sweeter than sugar. Must be avoided by individuals with phenylketonuria (PKU) — mandatory label warning required. IARC classified as "possibly carcinogenic" (Group 2B, 2023) based on limited evidence in animal studies; the ADI (40 mg/kg/day) established by JECFA remains unchanged. FSSAI-permitted in specified foods.',
 'FSSAI Reg 2011; JECFA 2023; IARC Monographs Vol 134 (2023)'),

('E952',  'Cyclamate',                     false, 'sweetener',   true,
 'Artificial sweetener. NOT permitted in India by FSSAI. Also banned in the USA. Check product labels if imported.',
 'FSSAI Prohibited List; FDA 21 CFR 189.135'),

('E955',  'Sucralose',                     true,  'sweetener',   true,
 'High-intensity sweetener, ~600× sweeter than sugar. Considered safe at ADI of 15 mg/kg/day (JECFA). FSSAI-permitted in foods marketed as "sugar-free" or "reduced sugar".',
 'FSSAI Reg 2011; WHO/FAO JECFA 2005');

-- Index for fast lookup by INS number
CREATE INDEX IF NOT EXISTS idx_additives_ins ON additives_ins(ins_number);
