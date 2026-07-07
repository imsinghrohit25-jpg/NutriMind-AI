// Unit conversion utilities for nutrition data normalisation.
// All canonical values are stored per 100 g (grams, mg, mcg, IU as appropriate).

export function kjToKcal(kj: number): number {
  return kj / 4.184;
}

export function kcalToKj(kcal: number): number {
  return kcal * 4.184;
}

export function gToMg(g: number): number {
  return g * 1000;
}

export function mgToG(mg: number): number {
  return mg / 1000;
}

// Vitamin A RAE (mcg) to IU: 1 mcg RAE = 3.333 IU (retinol); beta-carotene ratio differs,
// but FDC reports RAE which is retinol-equivalent — use the retinol factor as approximation.
export function vitaminARaeToIu(mcgRae: number): number {
  return mcgRae * 3.333;
}

// Vitamin D mcg to IU: 1 mcg = 40 IU
export function vitaminDMcgToIu(mcg: number): number {
  return mcg * 40;
}

// Scale a per-serving value to per 100 g.
export function perServingToPer100g(value: number, servingSizeG: number): number {
  if (servingSizeG <= 0) return value;
  return (value / servingSizeG) * 100;
}

// Parse serving-size text into grams.
// Handles: "30g", "30 g", "1 cup (240ml)", "100 mL", "2 tbsp", plain numbers.
export function parseServingSizeG(text: string | null | undefined): number | null {
  if (!text) return null;
  const s = text.trim();
  const kg = /(\d+(?:\.\d+)?)\s*kg/i.exec(s);
  if (kg) return parseFloat(kg[1]!) * 1000;
  const g = /(\d+(?:\.\d+)?)\s*g(?:ram)?s?/i.exec(s);
  if (g) return parseFloat(g[1]!);
  const ml = /(\d+(?:\.\d+)?)\s*m[lL]/i.exec(s);
  if (ml) return parseFloat(ml[1]!);  // ml ≈ g (water density)
  const plain = /^(\d+(?:\.\d+)?)$/.exec(s);
  if (plain) return parseFloat(plain[1]!);
  return null;
}

// Parse package/quantity strings: "200g", "500 ml", "1 kg", "400 g e"
export function parsePackageSizeG(text: string | null | undefined): number | null {
  if (!text) return null;
  const s = text.trim();
  const kg = /(\d+(?:\.\d+)?)\s*kg/i.exec(s);
  if (kg) return parseFloat(kg[1]!) * 1000;
  const g = /(\d+(?:\.\d+)?)\s*g(?:ram)?s?/i.exec(s);
  if (g) return parseFloat(g[1]!);
  const ml = /(\d+(?:\.\d+)?)\s*m[lL]/i.exec(s);
  if (ml) return parseFloat(ml[1]!);
  const l = /(\d+(?:\.\d+)?)\s*[lL](?:iter|itre)?s?\b/i.exec(s);
  if (l) return parseFloat(l[1]!) * 1000;
  return null;
}

// Detect barcode type from digit count.
export function detectBarcodeType(barcode: string): 'ean13' | 'ean8' | 'upc_a' | 'upc_e' | 'other' {
  const digits = barcode.replace(/\D/g, '');
  if (digits.length === 13) return 'ean13';
  if (digits.length === 8) return 'ean8';
  if (digits.length === 12) return 'upc_a';
  if (digits.length === 6) return 'upc_e';
  return 'other';
}
