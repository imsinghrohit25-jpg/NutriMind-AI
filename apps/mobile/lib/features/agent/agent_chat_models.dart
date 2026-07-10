/// One turn of the multi-agent chat — Phase 13 (§16, §18). Mutated in place as real SSE events
/// arrive from `POST /v1/agent/chat` (apps/api/src/agents/sse.ts), so the UI can show genuine
/// live progress (which agent(s) were routed to, which real tool each one called) rather than a
/// spinner that reveals nothing until the whole response is ready.
class AgentTurn {
  AgentTurn(this.userMessage);

  final String userMessage;

  /// Human-readable progress notes derived 1:1 from real `agent_started`/`tool_call`/
  /// `tool_result` events — never fabricated, just formatted.
  final List<String> progressLines = [];

  /// The most recent `agent_handoff` event's real handoffState — carries the structured signals
  /// (`lastOcrLowConfidenceFields`, `voiceAmbiguous`, `pendingFoodLog`, ...) the confirmation
  /// surfaces below are built from.
  Map<String, dynamic> lastHandoffState = {};

  /// The Output Guard's real, validated final answer (only ever set from a `done` event that
  /// already passed allergen re-check + numeric-claim validation server-side).
  String? finalText;

  /// Set from `guard_rejected` (Output Guard blocked the response) or `error` (transport/
  /// pipeline failure) — either way, the honest reason is shown, never a fabricated success.
  String? errorMessage;

  /// Local-only UI acknowledgement — tapping an OCR low-confidence field chip. There is no
  /// per-field commit endpoint in the tool registry yet (a real, documented gap — see
  /// agent_chat_screen.dart's own comment), so this only affects this turn's rendering.
  final Set<String> confirmedOcrFields = {};

  /// Local-only UI acknowledgement — confirming a Voice Agent `pendingFoodLog` handoff. Same
  /// honest gap as above: there is no `log.record` tool yet, so this cannot itself persist a
  /// meal log; it only reflects that the user confirmed the parse.
  bool foodLogConfirmed = false;

  bool get isPending => finalText == null && errorMessage == null;

  List<String> get lowConfidenceOcrFields =>
      (lastHandoffState['lastOcrLowConfidenceFields'] as List?)?.cast<String>() ?? const [];

  bool get isVoiceAmbiguous => lastHandoffState['voiceAmbiguous'] == true;

  Map<String, dynamic>? get pendingFoodLog =>
      lastHandoffState['pendingFoodLog'] as Map<String, dynamic>?;
}
