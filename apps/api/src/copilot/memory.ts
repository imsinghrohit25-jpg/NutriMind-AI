// Copilot memory — per-user conversation context for multi-turn dialogue.
// Stored in memory (not persisted across API restarts); Phase 10 will add
// semantic memory via embeddings (apps/api/src/memory/history-embeddings.ts).

export interface ConversationTurn {
  role:    'user' | 'assistant';
  content: string;
}

export interface ConversationContext {
  userId:  string;
  turns:   ConversationTurn[];
}

// Maximum retained turns (older turns are pruned to save context window)
const MAX_TURNS = 10;

const _store = new Map<string, ConversationContext>();

export function getContext(userId: string): ConversationContext {
  return _store.get(userId) ?? { userId, turns: [] };
}

export function appendTurn(
  userId: string,
  role: ConversationTurn['role'],
  content: string,
): void {
  const ctx = getContext(userId);
  ctx.turns.push({ role, content });

  // Prune to MAX_TURNS (keep most recent)
  if (ctx.turns.length > MAX_TURNS) {
    ctx.turns = ctx.turns.slice(ctx.turns.length - MAX_TURNS);
  }

  _store.set(userId, ctx);
}

export function clearContext(userId: string): void {
  _store.delete(userId);
}

export function buildHistoryMessages(
  userId: string,
): Array<{ role: 'user' | 'assistant'; content: string }> {
  const ctx = getContext(userId);
  // Exclude the latest user turn (will be sent as the current message)
  return ctx.turns.slice(0, -1);
}
