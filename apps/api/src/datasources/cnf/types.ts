// Row shapes for the real CNF file set — ADR-0032. Column names match this codebase's own
// field naming (camelCase), verified directly against the real distribution's header rows, not
// assumed from the older/differently-named file set some documentation describes (there is no
// separate "Conversion Factor"/"Refuse"/"Yield" file in this release — all three real concepts
// are unified in `Measure_Weight_Conversion.csv`, distinguished by `Measure_Type_Code`, per
// `Measure_Type.csv`: 3=Refuse, 6=household/user-defined conversion, 9=Yield — verified against
// real rows, e.g. a banana/orange-type food's Refuse row prints a real 30-40% figure, not grams).

export interface CnfFoodGroupRow {
  code: string; // CNF_Food_Group_Code
  nameEn: string;
  nameFr: string;
}

export interface CnfFoodSourceRow {
  code: string;
  descriptionEn: string;
  descriptionFr: string;
}

export interface CnfFoodNameRow {
  foodCode: string;
  descriptionEn: string;
  descriptionFr: string;
  alternateDescriptionEn: string;
  alternateDescriptionFr: string;
  foodSourceCode: string;
  usdaNdbCode: string;
  foodGroupCode: string;
  commentEn: string;
  commentFr: string;
  scientificName: string;
  lastUpdatedDate: string;
}

export interface CnfNutrientNameRow {
  nutrientCode: string;
  nutrientSymbol: string;
  nutrientUnit: string;
  nameEn: string;
  nameFr: string;
  tagname: string;
  decimals: string;
}

export interface CnfNutrientSourceRow {
  code: string;
  descriptionEn: string;
  descriptionFr: string;
}

export interface CnfNutrientAmountRow {
  foodCode: string;
  nutrientCode: string;
  amount: string;
  stdError: string;
  observations: string;
  nutrientSourceCode: string;
  lastUpdatedDate: string;
}

export interface CnfMeasureNameRow {
  code: string;
  descriptionEn: string;
  descriptionFr: string;
}

export interface CnfMeasureTypeRow {
  code: string;
  descriptionEn: string;
  descriptionFr: string;
}

export interface CnfMeasureWeightConversionRow {
  foodCode: string;
  measureTypeCode: string;
  measureCode: string;
  value: string; // grams for types 6/9; a 0-100 percentage for type 3 (Refuse)
  lastUpdatedDate: string;
}

export const CNF_MEASURE_TYPE = {
  REFUSE: '3',
  HOUSEHOLD: '6',
  YIELD: '9',
} as const;
