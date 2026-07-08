/// NutriMind AI Agent Layer — LLM orchestration, locale-aware prompts, PII redaction.
/// Phase 11 adds the client-side AI Memory System transparency DTO (`MemoryFact`); the
/// orchestration/prompt-assembly surface this library's doc comment originally promised remains
/// server-side (`apps/api/src/gateway/`, `apps/api/src/memory/`) and is not yet mirrored here.
library nutrimind_ai_agent_layer;

export 'src/memory_fact.dart';
