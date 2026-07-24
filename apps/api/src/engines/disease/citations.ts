// Regulatory and clinical citations for disease-specific guidance.
// All guidance shown in the app MUST be traceable to one of these citations.
// The citation ID is stored alongside each rule so the UI can render a reference.

export interface Citation {
  id: string;
  title: string;
  source: string;
  year: number;
  url?: string;
}

export const CITATIONS: Record<string, Citation> = {
  'who-sodium-2023': {
    id: 'who-sodium-2023',
    title: 'WHO Guideline: Sodium intake for adults and children',
    source: 'World Health Organization',
    year: 2023,
  },
  'icmr-nin-2020': {
    id: 'icmr-nin-2020',
    title: 'Nutrient Requirements for Indians — ICMR-NIN Recommended Dietary Allowances 2020',
    source: 'Indian Council of Medical Research / National Institute of Nutrition',
    year: 2020,
  },
  'who-sugar-2015': {
    id: 'who-sugar-2015',
    title: 'WHO Guideline: Sugars intake for adults and children',
    source: 'World Health Organization',
    year: 2015,
  },
  'fssai-labelling-2022': {
    id: 'fssai-labelling-2022',
    title: 'Food Safety and Standards (Labelling and Display) Regulations 2022',
    source: 'Food Safety and Standards Authority of India',
    year: 2022,
  },
  'who-hypertension-2021': {
    id: 'who-hypertension-2021',
    title: 'WHO Global Report on Hypertension: The Race Against a Silent Killer',
    source: 'World Health Organization',
    year: 2021,
  },
  'icmr-diabetes-2018': {
    id: 'icmr-diabetes-2018',
    title: 'RSSDI-ESI Clinical Practice Recommendations for Management of Type 2 Diabetes Mellitus in India',
    source: 'Research Society for Study of Diabetes in India / Endocrine Society of India',
    year: 2018,
  },
  'who-transfat-2023': {
    id: 'who-transfat-2023',
    title: 'WHO Calls on Countries to Eliminate Trans Fats by 2023',
    source: 'World Health Organization',
    year: 2023,
  },
  'who-child-sodium-2020': {
    id: 'who-child-sodium-2020',
    title: 'Reducing Salt Intake in Children and Adolescents',
    source: 'WHO Europe / PAHO',
    year: 2020,
  },
  'aha-child-sugar-2016': {
    id: 'aha-child-sugar-2016',
    title: 'Added Sugars and Cardiovascular Disease Risk in Children',
    source: 'American Heart Association Scientific Statement — Circulation, 2016',
    year: 2016,
  },
  'fssai-allergens-2023': {
    id: 'fssai-allergens-2023',
    title: 'Food Safety and Standards (Allergens) Regulations 2023',
    source: 'Food Safety and Standards Authority of India',
    year: 2023,
  },
  'who-satfat-2023': {
    id: 'who-satfat-2023',
    title: 'WHO Guideline: Saturated fatty acid and trans-fatty acid intake for adults and children',
    source: 'World Health Organization',
    year: 2023,
  },
  'kdoqi-nutrition-ckd-2020': {
    id: 'kdoqi-nutrition-ckd-2020',
    title: 'KDOQI Clinical Practice Guideline for Nutrition in CKD: 2020 Update',
    source: 'National Kidney Foundation — American Journal of Kidney Diseases',
    year: 2020,
  },
  'easl-nafld-2016': {
    id: 'easl-nafld-2016',
    title: 'EASL–EASD–EASO Clinical Practice Guidelines for the Management of Non-Alcoholic Fatty Liver Disease',
    source: 'European Association for the Study of the Liver',
    year: 2016,
  },
  'eshre-pcos-2023': {
    id: 'eshre-pcos-2023',
    title: 'International Evidence-based Guideline for the Assessment and Management of Polycystic Ovary Syndrome',
    source: 'ESHRE / Monash University',
    year: 2023,
  },
  'ata-hypothyroidism-2014': {
    id: 'ata-hypothyroidism-2014',
    title: 'Guidelines for the Treatment of Hypothyroidism (drug–food interactions incl. soy)',
    source: 'American Thyroid Association — Thyroid, 2014',
    year: 2014,
  },
  'who-antenatal-2016': {
    id: 'who-antenatal-2016',
    title: 'WHO Recommendations on Antenatal Care for a Positive Pregnancy Experience',
    source: 'World Health Organization',
    year: 2016,
  },
  'who-healthy-diet-2020': {
    id: 'who-healthy-diet-2020',
    title: 'WHO Fact Sheet: Healthy Diet',
    source: 'World Health Organization',
    year: 2020,
  },
  'esc-cvd-prevention-2021': {
    id: 'esc-cvd-prevention-2021',
    title: 'ESC Guidelines on Cardiovascular Disease Prevention in Clinical Practice',
    source: 'European Society of Cardiology — European Heart Journal',
    year: 2021,
  },
};
