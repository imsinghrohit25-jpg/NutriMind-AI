# ADR-0040: Premium Redesign — AI Diet Chat Markdown, Typing Indicator, and Retry

## Status
Accepted (Phase 4).

## Context
Phase 4's brief asks for a premium AI Diet Chat surface — animated avatar reacting to
thinking/streaming states, a typing indicator, markdown styling for the assistant's answer, and a
retry chip — on the exact same Gemini-backed multi-agent SSE stream (`POST /v1/agent/chat`),
contract untouched. Auditing `agent_chat_screen.dart` first (session-resume rule: never rebuild
what exists) found a fully real, already-functional chat surface: genuine incremental SSE progress
(`agent_started`/`tool_call`/`tool_result`/`agent_handoff`/`guard_rejected`/`done`/`error`), real
OCR low-confidence field confirmation chips, real Voice Agent food-log confirmation — all wired to
real tools, nothing mocked. What's missing is purely presentational:
- The assistant's `finalText` (the Output Guard's real, validated answer) renders as plain
  unstyled `Text`, even though the backend/model output is markdown-formatted prose.
- The "pending" state is a bare `CircularProgressIndicator`.
- There is no retry path at all on `errorMessage` — the user must retype the whole message.
- The screen uses a plain white `Scaffold`, no design-system chrome.

## Decision
1. **`flutter_markdown_plus: ^1.0.12`** (live-verified on pub.dev, not from training data) renders
   `finalText`. `flutter_markdown` (the historically default choice) was checked first and found
   discontinued upstream, which explicitly names `flutter_markdown_plus` as its replacement.
   `MarkdownStyleSheet` is built from the existing `AppType`/`AppColors` tokens — no new raw
   styles.
2. **Typing indicator**: new `lib/core/design_system/components/typing_indicator.dart`
   (`TypingIndicator` — three pulsing dots, `AnimationPolicyBuilder`-aware) replaces the bare
   spinner. Reusable beyond chat (any "assistant is composing" moment), so it lives in the shared
   design system, not inlined in the chat screen.
3. **Avatar**: `NutriMindLogo` (built in Phase 0, states already anticipated: idle/listening/
   thinking/celebrating) sits in the AppBar — `thinking` while the active turn `isPending`, `idle`
   otherwise. No new avatar state machine needed; Phase 0 already built exactly this.
4. **Retry**: `_AgentChatScreenState` gains a `_retry(AgentTurn turn)` that resets the *same* turn
   object's `errorMessage`/`progressLines`/`finalText` and re-dispatches the identical
   `userMessage` through the identical `postSse('/v1/agent/chat', ...)` call `_send` already uses
   (extracted into a shared `_dispatch` helper — no new endpoint, no changed payload shape). A
   small `ActionChip` next to the error banner triggers it. This is presentation-layer state
   management only; the backend contract, Output Guard, and Supervisor graph are untouched.
5. **Chrome**: `GradientScaffold` + `GlassCard`/`GlassCard.static` for assistant-side surfaces
   (progress lines, error banner, final-answer bubble, confirmation chips), user bubble kept as a
   solid primary-color pill (unchanged shape, now using design-system spacing/motion tokens).
6. **Zero backend changes.** `agents/sse.ts`, `agents/supervisor.ts`, the Output Guard, and every
   tool in the registry are untouched — verified via `git diff` scoped to `apps/api/`.

## Consequences
- `AgentTurn`/`agent_chat_models.dart` — no changes; retry reuses the existing mutable fields
  rather than adding new ones.
- The chat-mentioned Health Score (when an agent references one via a tool call) is already
  sourced from the same real engines Phase 3 wired up — this phase doesn't touch that data path,
  only how the surrounding text is rendered.
- `flutter_markdown_plus`'s maintenance is community-run (Foresight Mobile fork of the
  discontinued Flutter-team package) — documented here in case a future audit needs to know why
  this dependency isn't the historically "official" one.
