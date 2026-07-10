// Voice Agent — Phase 13 (§16.4.8). Interface agent: "Tools: none directly except voice_engine
// primitives; all domain work delegated through Supervisor" — this agent calls NO tool from the
// Shared Tool Registry itself (its allowlist in agent-specs.ts is deliberately empty). STT
// itself already happened on-device before this text ever reaches the backend
// (apps/mobile/lib/features/voice/voice_log_screen.dart uses speech_to_text locally, per Phase
// 6/ADR-0019) — this agent's real job is: parse the (already-transcribed) utterance via the real
// Hinglish NLU (voice/nlu.ts, LLM-backed), and either (a) ask ONE clarifying question when
// confidence is too low (never guess), or (b) produce a confirmation utterance from the real
// parse for a food-logging intent — it never itself calls food.lookup or persists a log; that is
// explicitly the next agent's job once the user confirms (§16.1.1's tool boundary).
//
// Honest, documented gap: `i18n/language.ts`'s SupportedLocale is only 'en'|'hi'|'mr' — Tamil is
// not implemented in the underlying NLU's locale handling yet, despite the addendum naming it;
// an unrecognized locale here degrades to 'en' NLU parsing rather than fabricating Tamil support.

import type { SpecialistAgentRunner } from '../agent-runner.js';
import { parseVoiceUtterance, type NLUResult } from '../../voice/nlu.js';
import type { SupportedLocale } from '../../i18n/language.js';

const CONFIDENCE_THRESHOLD = 0.6;
const KNOWN_LOCALES: SupportedLocale[] = ['en', 'hi', 'mr'];

function toSupportedLocale(locale: string): SupportedLocale {
  const lang = locale.split('-')[0]!.toLowerCase();
  return (KNOWN_LOCALES as string[]).includes(lang) ? (lang as SupportedLocale) : 'en';
}

function buildConfirmation(result: NLUResult): string {
  const foodList = result.foods
    .map((f) => `${f.quantity ?? ''}${f.unit ?? ''} ${f.name}`.trim())
    .join(', ');
  const mealPart = result.mealType ? ` for ${result.mealType}` : '';
  return `Did you have ${foodList}${mealPart}? Say yes to confirm.`;
}

export const runVoiceAgent: SpecialistAgentRunner = async (input) => {
  if (!input.ctx.gateway) {
    return {
      responseText: `Voice parsing needs the AI gateway, which isn't configured in this environment.`,
      toolTrace: [],
    };
  }

  const locale = toSupportedLocale(input.locale);
  const result = await parseVoiceUtterance({ text: input.message, locale, gateway: input.ctx.gateway });

  if (result.confidence < CONFIDENCE_THRESHOLD || result.intent === 'unknown') {
    return {
      responseText: `Sorry, I didn't quite catch that — could you say the food and quantity again?`,
      toolTrace: [],
      handoffState: { voiceAmbiguous: true },
    };
  }

  if (result.intent === 'log_meal' && result.foods.length > 0) {
    return {
      responseText: buildConfirmation(result),
      toolTrace: [],
      // Real structured handoff — the NEXT turn (after user confirmation) is what actually calls
      // food.lookup/logs the event, via the normal Supervisor->Nutrition Agent path; this agent
      // itself never touches a tool, per its empty allowlist.
      handoffState: { pendingFoodLog: { foods: result.foods, mealType: result.mealType }, normalizedMessage: result.rawText },
    };
  }

  // query_score / query_nutrients / set_portion / ask_alternative — normalize and hand off the
  // parsed food name(s) as real structured state for the Supervisor's NEXT classify pass (a
  // route-layer concern, §16.1.1's "structured state, never free-text between agents").
  return {
    responseText: `Got it — checking that for you.`,
    toolTrace: [],
    handoffState: { normalizedMessage: result.foods[0]?.name ?? result.rawText, voiceIntent: result.intent },
  };
};
