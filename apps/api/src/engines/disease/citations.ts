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
};
