// Text-to-speech response builder.
// NutriMind does NOT call a TTS API server-side — instead it returns structured
// SSML-compatible text for the mobile client to synthesize locally using the
// platform TTS engine (iOS: AVSpeechSynthesizer, Android: TextToSpeech API).
// This keeps latency low and avoids a round-trip for speech synthesis.

import type { SupportedLocale } from '../i18n/language.js';

export interface TTSPayload {
  text:     string;    // plain text for display
  ssml?:    string;    // SSML string for platform TTS (optional for clients that support it)
  locale:   SupportedLocale;
  lang:     string;    // BCP-47 language tag (e.g. 'en-IN', 'hi-IN', 'mr-IN')
  rate:     number;    // speech rate 0.5–2.0 (1.0 = normal)
}

const LANG_TAGS: Record<SupportedLocale, string> = {
  en: 'en-IN',
  hi: 'hi-IN',
  mr: 'mr-IN',
};

const NUTRITION_TEMPLATES: Record<SupportedLocale, {
  scoreGood:   (score: number, name: string) => string;
  scorePoor:   (score: number, name: string) => string;
  loggedMeal:  (foods: string[], kcal: number) => string;
  noData:      () => string;
}> = {
  en: {
    scoreGood:  (score, name) => `${name} scored ${score} out of 100. That's a healthy choice!`,
    scorePoor:  (score, name) => `${name} scored ${score} out of 100. Consider healthier alternatives.`,
    loggedMeal: (foods, kcal) => `Logged ${foods.join(' and ')}. That's about ${kcal} calories.`,
    noData:     () => "I couldn't find nutritional data for that food. Please scan the barcode.",
  },
  hi: {
    scoreGood:  (score, name) => `${name} का स्कोर ${score} है। यह एक स्वस्थ विकल्प है!`,
    scorePoor:  (score, name) => `${name} का स्कोर ${score} है। कोई बेहतर विकल्प आज़माएं।`,
    loggedMeal: (foods, kcal) => `${foods.join(' और ')} दर्ज किया गया। लगभग ${kcal} कैलोरी है।`,
    noData:     () => 'उस खाने का डेटा नहीं मिला। कृपया बारकोड स्कैन करें।',
  },
  mr: {
    scoreGood:  (score, name) => `${name} चा स्कोर ${score} आहे। हा एक निरोगी पर्याय आहे!`,
    scorePoor:  (score, name) => `${name} चा स्कोर ${score} आहे। चांगले पर्याय निवडा.`,
    loggedMeal: (foods, kcal) => `${foods.join(' आणि ')} नोंदवले. साधारण ${kcal} कॅलरी आहे.`,
    noData:     () => 'त्या अन्नाची माहिती मिळाली नाही. कृपया बारकोड स्कॅन करा.',
  },
};

export function buildScoreResponse(opts: {
  locale:    SupportedLocale;
  foodName:  string;
  score:     number;
}): TTSPayload {
  const { locale, foodName, score } = opts;
  const templates = NUTRITION_TEMPLATES[locale];
  const text = score >= 60
    ? templates.scoreGood(score, foodName)
    : templates.scorePoor(score, foodName);

  return {
    text,
    locale,
    lang: LANG_TAGS[locale],
    rate: 1.0,
  };
}

export function buildMealLogResponse(opts: {
  locale:    SupportedLocale;
  foodNames: string[];
  kcal:      number;
}): TTSPayload {
  const { locale, foodNames, kcal } = opts;
  const text = NUTRITION_TEMPLATES[locale].loggedMeal(foodNames, kcal);
  return { text, locale, lang: LANG_TAGS[locale], rate: 1.0 };
}

export function buildNoDataResponse(locale: SupportedLocale): TTSPayload {
  const text = NUTRITION_TEMPLATES[locale].noData();
  return { text, locale, lang: LANG_TAGS[locale], rate: 1.0 };
}
