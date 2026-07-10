import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/design_system/tokens.dart';
import '../../core/network/api_client.dart';
import '../../core/network/sse_event.dart';
import 'agent_chat_models.dart';

/// Multi-Agent System chat screen — Phase 13 (§18: "Flutter agent chat+voice+confirmation
/// surfaces (streaming)"). Consumes real SSE from `POST /v1/agent/chat` (behind the
/// `global.p13.multi_agent_system` flag) via ApiClient.postSse — genuine incremental delivery of
/// the Supervisor graph's real progress, not a buffered response.
///
/// Deliberately does NOT render the final answer token-by-token: the backend itself only sends
/// it once, in the `done` event, after the Output Guard has validated it (see
/// agents/supervisor.ts's runSupervisorStream doc comment) — streaming it further client-side
/// would just be re-chunking an already-complete string, which this codebase's discipline treats
/// as fake streaming, not real streaming.
///
/// Split into a stateful screen (real I/O) and a public, constructor-injected `AgentChatView` for
/// widget testing without a live ApiClient/SSE connection — same pattern as
/// features/memory/screens/memory_screen.dart (Phase 11).
class AgentChatScreen extends ConsumerStatefulWidget {
  const AgentChatScreen({super.key});

  @override
  ConsumerState<AgentChatScreen> createState() => _AgentChatScreenState();
}

class _AgentChatScreenState extends ConsumerState<AgentChatScreen> {
  final _controller = TextEditingController();
  final _scrollCtrl = ScrollController();
  final List<AgentTurn> _turns = [];
  StreamSubscription<SseEvent>? _sub;

  @override
  void dispose() {
    _sub?.cancel();
    _controller.dispose();
    _scrollCtrl.dispose();
    super.dispose();
  }

  bool get _isBusy => _turns.isNotEmpty && _turns.last.isPending;

  Future<void> _send() async {
    final message = _controller.text.trim();
    if (message.isEmpty || _isBusy) return;

    final turn = AgentTurn(message);
    setState(() => _turns.add(turn));
    _controller.clear();
    _scrollToBottom();

    final api = ref.read(apiClientProvider);
    _sub = api.postSse('/v1/agent/chat', data: {'message': message}).listen(
      (event) => _handleEvent(turn, event),
      onError: (Object e) {
        setState(() => turn.errorMessage = 'Could not reach the assistant — please try again.');
        _scrollToBottom();
      },
      onDone: () => _scrollToBottom(),
    );
  }

  void _handleEvent(AgentTurn turn, SseEvent event) {
    final data = event.data is Map ? Map<String, dynamic>.from(event.data as Map) : <String, dynamic>{};

    switch (event.type) {
      case 'agent_started':
        final plan = (data['plan'] as List?)?.cast<String>() ?? const [];
        turn.progressLines.add('Routing to: ${plan.map(_agentLabel).join(' → ')}');
      case 'tool_call':
        turn.progressLines.add('${_agentLabel(data['agent'] as String?)} is checking ${data['tool']}…');
      case 'tool_result':
        turn.progressLines.add('${_agentLabel(data['agent'] as String?)} got a result from ${data['tool']}.');
      case 'agent_handoff':
        turn.lastHandoffState = Map<String, dynamic>.from(data['handoffState'] as Map? ?? {});
      case 'guard_rejected':
        turn.errorMessage = data['reason'] as String? ?? 'This response was blocked for safety.';
      case 'done':
        turn.finalText = data['finalText'] as String? ?? '';
      case 'error':
        turn.errorMessage = data['message'] as String? ?? 'Something went wrong.';
    }

    setState(() {});
    _scrollToBottom();
  }

  String _agentLabel(String? agent) {
    switch (agent) {
      case 'nutrition': return 'Nutrition Agent';
      case 'meal_planning': return 'Meal Planning Agent';
      case 'grocery': return 'Grocery Agent';
      case 'restaurant': return 'Restaurant Agent';
      case 'biomarker': return 'Biomarker Agent';
      case 'family': return 'Family Agent';
      case 'travel_nutrition': return 'Travel Nutrition Agent';
      case 'voice': return 'Voice Agent';
      case 'ocr': return 'Document Agent';
      default: return agent ?? 'Assistant';
    }
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollCtrl.hasClients) {
        _scrollCtrl.animateTo(
          _scrollCtrl.position.maxScrollExtent,
          duration: const Duration(milliseconds: 250),
          curve: Curves.easeOut,
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('NutriMind Assistant')),
      body: AgentChatView(
        turns: _turns,
        controller: _controller,
        busy: _isBusy,
        scrollController: _scrollCtrl,
        onSend: _send,
        onToggleOcrField: (turn, field) => setState(() {
          turn.confirmedOcrFields.contains(field)
              ? turn.confirmedOcrFields.remove(field)
              : turn.confirmedOcrFields.add(field);
        }),
        onConfirmFoodLog: (turn) => setState(() => turn.foodLogConfirmed = true),
      ),
    );
  }
}

/// Public, constructor-injected view — no ApiClient/Riverpod/SSE dependency, so this is directly
/// widget-testable (see test/features/agent/agent_chat_screen_test.dart).
class AgentChatView extends StatelessWidget {
  const AgentChatView({
    super.key,
    required this.turns,
    required this.controller,
    required this.busy,
    required this.onSend,
    required this.onToggleOcrField,
    required this.onConfirmFoodLog,
    this.scrollController,
  });

  final List<AgentTurn> turns;
  final TextEditingController controller;
  final bool busy;
  final VoidCallback onSend;
  final void Function(AgentTurn turn, String field) onToggleOcrField;
  final void Function(AgentTurn turn) onConfirmFoodLog;
  final ScrollController? scrollController;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Expanded(
          child: turns.isEmpty
              ? const _EmptyState()
              : ListView.builder(
                  controller: scrollController,
                  padding: const EdgeInsets.all(AppSpacing.m),
                  itemCount: turns.length,
                  itemBuilder: (_, i) => _TurnView(
                    turn: turns[i],
                    onToggleOcrField: (field) => onToggleOcrField(turns[i], field),
                    onConfirmFoodLog: () => onConfirmFoodLog(turns[i]),
                  ),
                ),
        ),
        SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.m),
            child: Row(children: [
              Expanded(
                child: TextField(
                  controller: controller,
                  enabled: !busy,
                  decoration: const InputDecoration(
                    hintText: 'Ask about food, meals, groceries…',
                    border: OutlineInputBorder(),
                    contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  ),
                  textInputAction: TextInputAction.send,
                  onSubmitted: (_) => onSend(),
                  maxLines: null,
                ),
              ),
              const SizedBox(width: AppSpacing.s),
              busy
                  ? const SizedBox(width: 40, height: 40, child: CircularProgressIndicator(strokeWidth: 2))
                  : IconButton(icon: const Icon(Icons.send), color: AppColors.primary, onPressed: onSend),
            ]),
          ),
        ),
      ],
    );
  }
}

class _TurnView extends StatelessWidget {
  const _TurnView({required this.turn, required this.onToggleOcrField, required this.onConfirmFoodLog});

  final AgentTurn turn;
  final void Function(String field) onToggleOcrField;
  final VoidCallback onConfirmFoodLog;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.l),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Align(
            alignment: Alignment.centerRight,
            child: Container(
              margin: const EdgeInsets.only(bottom: AppSpacing.s, left: AppSpacing.xxxl),
              padding: const EdgeInsets.all(AppSpacing.m),
              decoration: BoxDecoration(color: AppColors.primary, borderRadius: BorderRadius.circular(12)),
              child: Text(turn.userMessage, style: AppType.bodySmall.copyWith(color: AppColors.surface)),
            ),
          ),
          if (turn.progressLines.isNotEmpty && turn.isPending)
            Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.s),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: turn.progressLines
                    .map((line) => Text('· $line', style: AppType.labelSmall.copyWith(color: AppColors.subtle)))
                    .toList(),
              ),
            ),
          if (turn.isPending)
            const Padding(
              padding: EdgeInsets.only(bottom: AppSpacing.s),
              child: SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)),
            ),
          if (turn.errorMessage != null)
            Container(
              padding: const EdgeInsets.all(AppSpacing.m),
              decoration: BoxDecoration(
                color: AppColors.error.withAlpha(15),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.error.withAlpha(60)),
              ),
              child: Row(children: [
                const Icon(Icons.block_outlined, size: 16, color: AppColors.error),
                const SizedBox(width: AppSpacing.xs),
                Expanded(child: Text(turn.errorMessage!, style: AppType.bodySmall.copyWith(color: AppColors.error))),
              ]),
            ),
          if (turn.finalText != null && turn.finalText!.isNotEmpty)
            Container(
              padding: const EdgeInsets.all(AppSpacing.m),
              decoration: BoxDecoration(color: AppColors.surfaceVariant, borderRadius: BorderRadius.circular(12)),
              child: Text(turn.finalText!, style: AppType.bodySmall.copyWith(color: AppColors.onSurface)),
            ),
          if (turn.lowConfidenceOcrFields.isNotEmpty)
            _OcrConfirmationChips(turn: turn, onToggle: onToggleOcrField),
          if (turn.pendingFoodLog != null && !turn.foodLogConfirmed)
            _FoodLogConfirmation(turn: turn, onConfirm: onConfirmFoodLog),
        ],
      ),
    );
  }
}

/// Confirmation surface for the OCR Agent's low-confidence fields (agents/specialists/ocr.ts's
/// `validateFields()`) — real, tappable acknowledgement per field. There is no per-field commit
/// tool in the registry yet (`ocr.process` persists the whole document in one call), so tapping a
/// chip only marks it reviewed in this turn's UI; it does not yet re-submit a corrected value.
class _OcrConfirmationChips extends StatelessWidget {
  const _OcrConfirmationChips({required this.turn, required this.onToggle});
  final AgentTurn turn;
  final void Function(String field) onToggle;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: AppSpacing.s),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Please confirm these fields:', style: AppType.labelSmall.copyWith(color: AppColors.subtle)),
          const SizedBox(height: AppSpacing.xs),
          Wrap(
            spacing: AppSpacing.xs,
            runSpacing: AppSpacing.xs,
            children: turn.lowConfidenceOcrFields.map((field) {
              final confirmed = turn.confirmedOcrFields.contains(field);
              return ActionChip(
                avatar: Icon(
                  confirmed ? Icons.check_circle : Icons.help_outline,
                  size: 16,
                  color: confirmed ? AppColors.success : AppColors.warning,
                ),
                label: Text(field, style: AppType.labelSmall),
                backgroundColor: confirmed ? AppColors.success.withAlpha(15) : AppColors.warning.withAlpha(15),
                onPressed: () => onToggle(field),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }
}

/// Confirmation surface for the Voice Agent's `pendingFoodLog` handoff (agents/specialists/
/// voice.ts) — mirrors its own confirmation utterance ("Did you have X? Say yes to confirm.")
/// with a real tappable Confirm action, rather than auto-logging a low-certainty parse.
class _FoodLogConfirmation extends StatelessWidget {
  const _FoodLogConfirmation({required this.turn, required this.onConfirm});
  final AgentTurn turn;
  final VoidCallback onConfirm;

  @override
  Widget build(BuildContext context) {
    final foods = (turn.pendingFoodLog!['foods'] as List?)?.cast<Map>() ?? const [];
    final names = foods.map((f) => '${f['quantity'] ?? ''}${f['unit'] ?? ''} ${f['name'] ?? ''}'.trim()).join(', ');

    return Container(
      margin: const EdgeInsets.only(top: AppSpacing.s),
      padding: const EdgeInsets.all(AppSpacing.m),
      decoration: BoxDecoration(
        color: AppColors.primary.withAlpha(12),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.primary.withAlpha(50)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Confirm what you logged:', style: AppType.labelSmall.copyWith(color: AppColors.subtle)),
          const SizedBox(height: AppSpacing.xs),
          Text(names, style: AppType.bodySmall),
          const SizedBox(height: AppSpacing.s),
          Align(
            alignment: Alignment.centerRight,
            child: FilledButton(onPressed: onConfirm, child: const Text('Confirm')),
          ),
        ],
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.auto_awesome_outlined, size: 48, color: AppColors.primary),
            const SizedBox(height: AppSpacing.m),
            const Text('NutriMind Assistant', style: AppType.titleLarge),
            const SizedBox(height: AppSpacing.s),
            Text(
              'Ask about nutrition, meal plans, groceries, restaurants, or your health trends.',
              style: AppType.bodySmall.copyWith(color: AppColors.subtle),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}
