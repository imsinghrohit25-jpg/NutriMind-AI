// IFCT 2017 CSV parser.
// Parses the expected format documented in format.md.
// Uses Node's built-in readline — no external CSV dependency needed for this well-structured format.

import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';

export interface IfctEntry {
  foodCode: string;
  foodNameEn: string;
  foodNameHi: string;
  foodGroup: string;
  moistureG: number | null;
  energyKcal: number | null;
  proteinG: number | null;
  fatTotalG: number | null;
  carbohydratesG: number | null;
  dietaryFiberG: number | null;
  sugarsG: number | null;
  ashG: number | null;
  calciumMg: number | null;
  phosphorusMg: number | null;
  ironMg: number | null;
  sodiumMg: number | null;
  potassiumMg: number | null;
  zincMg: number | null;
  vitaminCMg: number | null;
  betaCaroteneMcg: number | null;
  thiamineMg: number | null;
  riboflavinMg: number | null;
  niacinMg: number | null;
  folateMcg: number | null;
  vitaminB12Mcg: number | null;
  cholesterolMg: number | null;
}

type Row = Record<string, string>;

// Parse a CSV line respecting quoted fields (RFC 4180).
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (inQuotes) {
      if (ch === '"') {
        // Peek for escaped quote
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        fields.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
  }
  fields.push(current);
  return fields;
}

function num(row: Row, key: string): number | null {
  const v = row[key.toLowerCase()]?.trim();
  if (!v || v === '' || v === '-') return null;
  const n = parseFloat(v);
  return isFinite(n) ? n : null;
}

function str(row: Row, key: string): string {
  return row[key.toLowerCase()]?.trim() ?? '';
}

function rowToEntry(row: Row): IfctEntry | null {
  const foodCode = str(row, 'food_code');
  const foodNameEn = str(row, 'food_name_en');
  if (!foodCode || !foodNameEn) return null;

  return {
    foodCode,
    foodNameEn,
    foodNameHi: str(row, 'food_name_hi'),
    foodGroup: str(row, 'food_group'),
    moistureG: num(row, 'moisture_g'),
    energyKcal: num(row, 'energy_kcal'),
    proteinG: num(row, 'protein_g'),
    fatTotalG: num(row, 'fat_total_g'),
    carbohydratesG: num(row, 'carbohydrates_g'),
    dietaryFiberG: num(row, 'dietary_fiber_g'),
    sugarsG: num(row, 'sugars_g'),
    ashG: num(row, 'ash_g'),
    calciumMg: num(row, 'calcium_mg'),
    phosphorusMg: num(row, 'phosphorus_mg'),
    ironMg: num(row, 'iron_mg'),
    sodiumMg: num(row, 'sodium_mg'),
    potassiumMg: num(row, 'potassium_mg'),
    zincMg: num(row, 'zinc_mg'),
    vitaminCMg: num(row, 'vitamin_c_mg'),
    betaCaroteneMcg: num(row, 'beta_carotene_mcg'),
    thiamineMg: num(row, 'thiamine_mg'),
    riboflavinMg: num(row, 'riboflavin_mg'),
    niacinMg: num(row, 'niacin_mg'),
    folateMcg: num(row, 'folate_mcg'),
    vitaminB12Mcg: num(row, 'vitamin_b12_mcg'),
    cholesterolMg: num(row, 'cholesterol_mg'),
  };
}

export async function parseIfctCsv(filePath: string): Promise<IfctEntry[]> {
  const entries: IfctEntry[] = [];
  const stream = createReadStream(filePath, { encoding: 'utf8' });
  const rl = createInterface({ input: stream, crlfDelay: Infinity });

  let headers: string[] | null = null;

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const fields = parseCsvLine(trimmed);
    if (headers === null) {
      headers = fields.map((h) => h.toLowerCase().trim());
      continue;
    }
    const row: Row = {};
    headers.forEach((h, i) => {
      row[h] = fields[i] ?? '';
    });
    const entry = rowToEntry(row);
    if (entry) entries.push(entry);
  }

  return entries;
}
