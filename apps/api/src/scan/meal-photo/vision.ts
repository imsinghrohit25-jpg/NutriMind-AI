// Meal photo vision — identifies dishes in a food photograph via the gateway.
// Uses the vision_analysis tier (multimodal LLM).
// Output is always treated as a classification suggestion, not ground truth.
// Confidence is explicit; caller shows confirmation UI when < 0.75.

import type { GatewayRouter } from '../../gateway/router.js';

export interface DishCandidate {
  name: string;
  nameLocalised: string | null;  // Hindi/regional transliteration if detected
  confidence: number;            // 0–1
  cuisine: string | null;
  portionSizeHint: string | null; // e.g. "medium bowl", "1 roti"
  searchQuery: string;           // formatted for IFCT/USDA search
}

export interface MealPhotoVisionResult {
  candidates: DishCandidate[];
  sceneDescription: string;
  isFood: boolean;
  isIndianFood: boolean;
  notes: string | null;
}

const VISION_SYSTEM = `You are a food identification assistant covering Indian and international cuisine.
Analyse the provided food photograph and identify EVERY distinct dish or food item present — a meal
photo often contains several (e.g. dal + rice + roti + salad, or burger + fries + drink). List each
one as its own candidate.
You specialise in Indian foods from all regional cuisines (North Indian, South Indian, Bengali,
Maharashtrian, Gujarati, etc.) and equally recognise international foods (Continental, Chinese,
Italian, Mexican, Middle Eastern, Japanese, American fast food, etc.).
For each dish, provide its common English name and the best search query for a nutrition database
(IFCT for Indian foods, USDA for international foods) — e.g. "dal tadka cooked" or "cheese pizza slice".
Estimate the visible portion size for each dish (e.g. "medium bowl", "2 pieces", "large plate").
Be honest about confidence; never guess dish names you cannot see clearly.
Return ONLY valid JSON in the following format:
{
  "isFood": true,
  "isIndianFood": true,
  "sceneDescription": "description of what you see",
  "candidates": [
    {
      "name": "dish name in English",
      "nameLocalised": "Hindi/regional name or null",
      "confidence": 0.9,
      "cuisine": "North Indian",
      "portionSizeHint": "medium bowl",
      "searchQuery": "dal tadka cooked"
    }
  ],
  "notes": null
}`;

export async function analyseMealPhoto(
  imageBase64: string,
  imageMediaType: 'image/jpeg' | 'image/png' | 'image/webp',
  gateway: GatewayRouter,
  traceId: string,
): Promise<MealPhotoVisionResult> {
  const response = await gateway.complete({
    tier: 'vision_analysis',
    messages: [
      {
        role: 'user',
        content: 'Please identify all dishes visible in this image. Return valid JSON only.',
      },
    ],
    systemPrompt: VISION_SYSTEM,
    images: [{ mimeType: imageMediaType, data: imageBase64 }],
    traceId,
    maxTokens: 800,
    temperature: 0,
  });

  try {
    // Strip markdown code fences if present
    const raw = response.content.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
    const parsed = JSON.parse(raw) as {
      isFood?: boolean;
      isIndianFood?: boolean;
      sceneDescription?: string;
      candidates?: Array<{
        name?: string;
        nameLocalised?: string | null;
        confidence?: number;
        cuisine?: string | null;
        portionSizeHint?: string | null;
        searchQuery?: string;
      }>;
      notes?: string | null;
    };

    const candidates: DishCandidate[] = (parsed.candidates ?? [])
      .slice(0, 5)
      .map((c) => ({
        name: c.name ?? 'Unknown',
        nameLocalised: c.nameLocalised ?? null,
        confidence: typeof c.confidence === 'number' ? Math.min(1, Math.max(0, c.confidence)) : 0.5,
        cuisine: c.cuisine ?? null,
        portionSizeHint: c.portionSizeHint ?? null,
        searchQuery: c.searchQuery ?? c.name ?? 'unknown food',
      }));

    return {
      candidates,
      sceneDescription: parsed.sceneDescription ?? '',
      isFood: parsed.isFood ?? false,
      isIndianFood: parsed.isIndianFood ?? false,
      notes: parsed.notes ?? null,
    };
  } catch {
    return {
      candidates: [],
      sceneDescription: 'Vision analysis failed',
      isFood: false,
      isIndianFood: false,
      notes: 'Failed to parse vision model response',
    };
  }
}
