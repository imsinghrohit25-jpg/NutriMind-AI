// Ingredient list tokenizer — splits FSSAI-format ingredients strings into tokens.
// Handles: nested parentheses, percentage declarations, and comma-separated lists.
// Example: "Wheat Flour (72%), Sugar, Edible Vegetable Oil (Palm), Salt (0.8%)"

export interface IngredientToken {
  name: string;
  percentageRaw: string | null;  // e.g. "72%"
  percentage: number | null;     // e.g. 72
  subIngredients: IngredientToken[];
  notes: string[];               // e.g. ["may contain traces of nuts"]
  rawText: string;
}

export function tokenizeIngredients(rawText: string): IngredientToken[] {
  if (!rawText || rawText.trim().length === 0) return [];

  // Clean up common OCR artefacts
  const cleaned = rawText
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^ingredients?\s*:?\s*/i, '');

  return parseLevel(cleaned);
}

function parseLevel(text: string): IngredientToken[] {
  const tokens: IngredientToken[] = [];
  let depth = 0;
  let start = 0;
  const parts: string[] = [];

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(' || ch === '[') {
      depth++;
    } else if (ch === ')' || ch === ']') {
      depth--;
    } else if (ch === ',' && depth === 0) {
      parts.push(text.slice(start, i).trim());
      start = i + 1;
    }
  }
  if (start < text.length) {
    parts.push(text.slice(start).trim());
  }

  for (const part of parts) {
    if (!part) continue;
    tokens.push(parseToken(part));
  }

  return tokens;
}

function parseToken(raw: string): IngredientToken {
  const token: IngredientToken = {
    name: '',
    percentageRaw: null,
    percentage: null,
    subIngredients: [],
    notes: [],
    rawText: raw,
  };

  // Extract sub-ingredient block: "Name (sub1, sub2, ...)" or "Name [sub1, sub2]"
  const parenMatch = raw.match(/^(.*?)\s*[\(\[](.*?)[\)\]]\s*(.*)$/s);
  if (parenMatch) {
    const beforeParen = parenMatch[1]!.trim();
    const insideParen = parenMatch[2]!.trim();
    const afterParen  = parenMatch[3]!.trim();

    // Detect if the parenthesised content is a percentage
    if (/^\d+(?:[.,]\d+)?\s*%?$/.test(insideParen)) {
      const numStr = insideParen.replace(',', '.').replace('%', '').trim();
      token.percentageRaw = insideParen;
      token.percentage = parseFloat(numStr);
      token.name = _extractPercentAndName(beforeParen + (afterParen ? ' ' + afterParen : ''), token);
    } else if (/^\d+(?:[.,]\d+)?\s*%?\s*/.test(insideParen) && insideParen.includes(',')) {
      // Percentage at start then sub-ingredients: "72%, Salt, Sugar"
      const pctMatch = insideParen.match(/^(\d+(?:[.,]\d+)?)\s*%?\s*,?\s*(.*)/s);
      if (pctMatch) {
        token.percentageRaw = pctMatch[1]! + '%';
        token.percentage = parseFloat(pctMatch[1]!.replace(',', '.'));
        if (pctMatch[2]) token.subIngredients = parseLevel(pctMatch[2]);
      }
      token.name = beforeParen.trim();
    } else {
      // Sub-ingredients block
      token.name = beforeParen.trim();
      // Check if insideParen looks like a list of ingredients
      if (insideParen.includes(',') || /^[A-Za-z]/.test(insideParen)) {
        token.subIngredients = parseLevel(insideParen);
      } else {
        token.notes.push(insideParen);
      }
      if (afterParen) {
        const pct = afterParen.match(/(\d+(?:[.,]\d+)?)\s*%/);
        if (pct) {
          token.percentageRaw = pct[0]!;
          token.percentage = parseFloat(pct[1]!.replace(',', '.'));
        }
      }
    }
  } else {
    // No parentheses — check for trailing percentage
    const pctMatch = raw.match(/^(.*?)\s+(\d+(?:[.,]\d+)?)\s*%\s*$/);
    if (pctMatch) {
      token.name = pctMatch[1]!.trim();
      token.percentageRaw = pctMatch[2]! + '%';
      token.percentage = parseFloat(pctMatch[2]!.replace(',', '.'));
    } else {
      token.name = raw.trim();
    }
  }

  return token;
}

function _extractPercentAndName(text: string, token: IngredientToken): string {
  // If there's a leading/trailing percentage in the text, extract it
  const pct = text.match(/(\d+(?:[.,]\d+)?)\s*%/);
  if (pct) {
    token.percentageRaw = pct[0]!;
    token.percentage = parseFloat(pct[1]!.replace(',', '.'));
    return text.replace(pct[0]!, '').trim();
  }
  return text.trim();
}
