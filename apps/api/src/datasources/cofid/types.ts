// Row shapes for the real UK CoFID 2021 workbook — ADR-0033. Verified directly against the real
// distribution (McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021.xlsx): a 14-sheet
// Excel workbook, not a flat table. Each nutrient sheet shares the same 7 identity columns (Food
// Code, Food Name, Description, Group, Previous, Main data references, Footnote) followed by
// nutrient columns; row 1 has the human-readable header, row 2 has the CoFID tagname (e.g. 'PROT',
// 'VITC'), row 3 a short label, data starts row 4. Nutrient cell values are read as raw strings
// (never coerced to number here) so validate.ts can interpret CoFID's real symbol set (see
// xlsx-loader.ts's own header comment) without silently losing information.

export interface CofidFoodRow {
  foodCode: string;
  foodName: string;
  description: string; // real values are sample/provenance notes ("8 cans", "Literature sources"),
                        // NOT an alternate food name — verified directly, never used as an alias.
  groupCode: string;
  previous: string;
  mainDataReferences: string;
  footnote: string;
}
