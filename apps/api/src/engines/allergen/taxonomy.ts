// Allergen taxonomy — 14 major allergens per FSSAI + EU (for imported products),
// extended with common Indian allergens (sesame, mustard, tree nuts).
// Source: FSSAI Food Safety and Standards (Allergens) Regulations 2023;
//         EU Regulation 1169/2011 Annex II.

export const ALLERGEN_IDS = [
  'gluten',
  'peanut',
  'tree_nuts',
  'milk',
  'egg',
  'soy',
  'fish',
  'shellfish',
  'sesame',
  'mustard',
  'celery',
  'lupin',
  'molluscs',
  'sulphites',
] as const;

export type AllergenId = (typeof ALLERGEN_IDS)[number];

export interface AllergenDefinition {
  id: AllergenId;
  displayName: string;
  fssaiMandatoryDeclaration: boolean;  // required on Indian label
  // All keyword forms that indicate this allergen (case-insensitive)
  keywords: string[];
  // Keyword forms for "may contain" traces
  traceKeywords: string[];
}

export const ALLERGEN_TAXONOMY: AllergenDefinition[] = [
  {
    id: 'gluten',
    displayName: 'Gluten (Wheat/Barley/Rye)',
    fssaiMandatoryDeclaration: true,
    keywords: [
      'wheat', 'barley', 'rye', 'oat', 'triticale', 'spelt', 'kamut',
      'semolina', 'durum', 'gluten', 'atta', 'maida', 'suji', 'sooji',
      'bread flour', 'wheat starch', 'wheat germ',
    ],
    traceKeywords: [
      'may contain gluten', 'may contain wheat', 'processed in a facility with wheat',
    ],
  },
  {
    id: 'peanut',
    displayName: 'Peanut (Groundnut)',
    fssaiMandatoryDeclaration: true,
    keywords: [
      'peanut', 'groundnut', 'monkey nut', 'arachis oil', 'peanut oil',
      'peanut butter', 'peanut flour', 'mixed nuts',
    ],
    traceKeywords: [
      'may contain peanut', 'may contain groundnut', 'may contain nuts',
      'manufactured in a facility that processes peanuts',
      'processed in a facility with peanut',
    ],
  },
  {
    id: 'tree_nuts',
    displayName: 'Tree Nuts',
    fssaiMandatoryDeclaration: true,
    keywords: [
      'almond', 'cashew', 'walnut', 'pistachio', 'hazelnut', 'coconut',
      'brazil nut', 'pine nut', 'macadamia', 'pecan', 'chestnut',
      'kaju', 'badam', 'akhrot', 'pista', 'mixed nuts',
    ],
    traceKeywords: [
      'may contain nuts', 'may contain tree nuts', 'may contain cashew',
      'may contain almond', 'may contain walnut',
    ],
  },
  {
    id: 'milk',
    displayName: 'Milk (Dairy)',
    fssaiMandatoryDeclaration: true,
    keywords: [
      'milk', 'dairy', 'lactose', 'whey', 'casein', 'caseinate',
      'butter', 'ghee', 'cream', 'cheese', 'paneer', 'curd', 'yogurt',
      'yoghurt', 'buttermilk', 'lactose', 'milk solids', 'milk powder',
      'skimmed milk', 'whole milk', 'condensed milk', 'evaporated milk',
    ],
    traceKeywords: [
      'may contain milk', 'may contain dairy', 'may contain lactose',
    ],
  },
  {
    id: 'egg',
    displayName: 'Egg',
    fssaiMandatoryDeclaration: true,
    keywords: [
      'egg', 'eggs', 'albumin', 'albumen', 'lecithin (egg)', 'egg white',
      'egg yolk', 'dried egg', 'egg powder', 'globulin', 'lysozyme',
      'mayonnaise', 'meringue',
    ],
    traceKeywords: [
      'may contain egg', 'may contain eggs',
    ],
  },
  {
    id: 'soy',
    displayName: 'Soy (Soybean)',
    fssaiMandatoryDeclaration: true,
    keywords: [
      'soy', 'soya', 'soybean', 'soy protein', 'soy flour', 'soy sauce',
      'tamari', 'textured vegetable protein', 'tvp', 'edamame', 'miso',
      'tofu', 'tempeh', 'natto', 'soy lecithin', 'soy oil',
    ],
    traceKeywords: [
      'may contain soy', 'may contain soya', 'may contain soybean',
    ],
  },
  {
    id: 'fish',
    displayName: 'Fish',
    fssaiMandatoryDeclaration: true,
    keywords: [
      'fish', 'anchovy', 'anchovies', 'sardine', 'tuna', 'salmon',
      'mackerel', 'cod', 'fish sauce', 'fish paste', 'fish oil',
      'worcestershire sauce',
    ],
    traceKeywords: [
      'may contain fish',
    ],
  },
  {
    id: 'shellfish',
    displayName: 'Shellfish / Crustaceans',
    fssaiMandatoryDeclaration: true,
    keywords: [
      'shrimp', 'prawn', 'crab', 'lobster', 'crayfish', 'barnacle',
      'scampi', 'krill', 'shrimp paste', 'prawn paste',
    ],
    traceKeywords: [
      'may contain shellfish', 'may contain crustacean', 'may contain shrimp',
    ],
  },
  {
    id: 'sesame',
    displayName: 'Sesame',
    fssaiMandatoryDeclaration: true,  // FSSAI 2023 amendment
    keywords: [
      'sesame', 'til', 'gingelly', 'tahini', 'sesame oil', 'sesame seed',
      'sesame paste',
    ],
    traceKeywords: [
      'may contain sesame', 'may contain til',
    ],
  },
  {
    id: 'mustard',
    displayName: 'Mustard',
    fssaiMandatoryDeclaration: false,  // FSSAI does not yet mandate; EU does
    keywords: [
      'mustard', 'mustard seed', 'mustard oil', 'mustard flour', 'mustard paste',
      'mustard leaves', 'sarson', 'rai',
    ],
    traceKeywords: [
      'may contain mustard',
    ],
  },
  {
    id: 'celery',
    displayName: 'Celery',
    fssaiMandatoryDeclaration: false,
    keywords: ['celery', 'celeriac', 'celery seed', 'celery salt', 'celery oil'],
    traceKeywords: ['may contain celery'],
  },
  {
    id: 'lupin',
    displayName: 'Lupin',
    fssaiMandatoryDeclaration: false,
    keywords: ['lupin', 'lupine', 'lupin flour', 'lupin seed', 'lupin bean'],
    traceKeywords: ['may contain lupin'],
  },
  {
    id: 'molluscs',
    displayName: 'Molluscs',
    fssaiMandatoryDeclaration: false,
    keywords: [
      'squid', 'octopus', 'clam', 'oyster', 'mussel', 'scallop', 'abalone',
      'snail', 'escargot',
    ],
    traceKeywords: ['may contain mollusc', 'may contain shellfish'],
  },
  {
    id: 'sulphites',
    displayName: 'Sulphites / Sulphur dioxide',
    fssaiMandatoryDeclaration: true,  // required when > 10 mg/kg
    keywords: [
      'sulphite', 'sulfite', 'sulphur dioxide', 'sulfur dioxide',
      'sodium metabisulphite', 'potassium metabisulphite',
      'sodium sulphite', 'e220', 'e221', 'e222', 'e223', 'e224',
    ],
    traceKeywords: ['may contain sulphites', 'may contain sulfites'],
  },
];

export const ALLERGEN_MAP = new Map<AllergenId, AllergenDefinition>(
  ALLERGEN_TAXONOMY.map((a) => [a.id, a]),
);
