// Voice food logging — hold-to-record, STT via platform speech_to_text, then sends the
// transcript through the real Phase 13 Voice Agent (POST /v1/agent/chat, SSE) rather than the
// older /v1/voice/parse endpoint, which had no confidence gating at all. The Voice Agent's own
// contract (agents/specialists/voice.ts): below its confidence threshold it asks ONE clarifying
// question instead of guessing, and above threshold it returns a confirmation utterance the user
// must accept before anything is treated as logged — this screen mirrors both states instead of
// always showing whatever was parsed.

import '../../core/design_system/components/app_loader.dart';
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:speech_to_text/speech_to_text.dart';
import 'package:flutter_tts/flutter_tts.dart';
import '../../core/design_system/app_palette.dart';
import '../../core/design_system/tokens.dart';
import '../../core/network/api_client.dart';
import '../../core/network/sse_event.dart';

class VoiceLogScreen extends ConsumerStatefulWidget {
  const VoiceLogScreen({super.key});

  @override
  ConsumerState<VoiceLogScreen> createState() => _VoiceLogScreenState();
}

class _VoiceLogScreenState extends ConsumerState<VoiceLogScreen> {
  final SpeechToText _stt    = SpeechToText();
  final FlutterTts   _tts    = FlutterTts();
  bool   _sttReady    = false;
  bool   _listening   = false;
  bool   _processing  = false;
  String _transcript  = '';
  String? _responseText;
  bool   _ambiguous   = false;
  List<Map<String, dynamic>> _pendingFoods = [];
  bool   _foodLogConfirmed = false;
  String? _error;
  StreamSubscription<SseEvent>? _sub;

  @override
  void initState() {
    super.initState();
    _initStt();
    _initTts();
  }

  Future<void> _initStt() async {
    final ready = await _stt.initialize(onError: (e) {
      if (mounted) setState(() => _error = e.errorMsg);
    });
    if (mounted) setState(() => _sttReady = ready);
  }

  Future<void> _initTts() async {
    await _tts.setLanguage('en-IN');
    await _tts.setSpeechRate(1.0);
  }

  @override
  void dispose() {
    _sub?.cancel();
    _stt.stop();
    _tts.stop();
    super.dispose();
  }

  Future<void> _startListening() async {
    if (!_sttReady || _listening) return;
    setState(() {
      _transcript = '';
      _responseText = null;
      _ambiguous = false;
      _pendingFoods = [];
      _foodLogConfirmed = false;
      _error = null;
    });
    await _stt.listen(
      onResult: (r) {
        if (mounted) setState(() => _transcript = r.recognizedWords);
        if (r.finalResult) _sendToAgent(r.recognizedWords);
      },
      listenOptions: SpeechListenOptions(
        localeId:      'en_IN',
        cancelOnError: true,
      ),
    );
    if (mounted) setState(() => _listening = true);
  }

  Future<void> _stopListening() async {
    await _stt.stop();
    if (mounted) setState(() => _listening = false);
    if (_transcript.isNotEmpty && _responseText == null && !_processing) {
      _sendToAgent(_transcript);
    }
  }

  Future<void> _sendToAgent(String text) async {
    if (text.trim().isEmpty) return;
    setState(() {
      _processing = true;
      _error = null;
      _responseText = null;
      _ambiguous = false;
      _pendingFoods = [];
      _foodLogConfirmed = false;
    });

    final api = ref.read(apiClientProvider);
    Map<String, dynamic> handoffState = {};

    _sub = api.postSse('/v1/agent/chat', data: {'message': text, 'locale': 'en-IN'}).listen(
      (event) {
        final data = event.data is Map ? Map<String, dynamic>.from(event.data as Map) : <String, dynamic>{};
        switch (event.type) {
          case 'agent_handoff':
            handoffState = Map<String, dynamic>.from(data['handoffState'] as Map? ?? {});
          case 'done':
            _finish(data['finalText'] as String? ?? '', handoffState);
          case 'guard_rejected':
            _finish(null, handoffState, error: data['reason'] as String? ?? 'This response was blocked.');
          case 'error':
            _finish(null, handoffState, error: data['message'] as String? ?? 'Something went wrong.');
        }
      },
      onError: (Object e) => _finish(null, handoffState, error: 'Could not reach the assistant.'),
    );
  }

  Future<void> _finish(String? text, Map<String, dynamic> handoffState, {String? error}) async {
    if (!mounted) return;
    final foods = (handoffState['pendingFoodLog'] as Map?)?['foods'] as List?;
    setState(() {
      _processing = false;
      _error = error;
      _responseText = text;
      _ambiguous = handoffState['voiceAmbiguous'] == true;
      _pendingFoods = foods?.cast<Map<String, dynamic>>() ?? [];
    });

    if (text != null && text.isNotEmpty) {
      await _tts.speak(text);
    }
  }

  void _confirmFoodLog() {
    setState(() => _foodLogConfirmed = true);
    // Honest, documented gap: there is no `log.record` tool in the Shared Tool Registry yet
    // (agents/types.ts's ToolName union has no meal-logging tool), so confirming here can only
    // acknowledge the parse, not persist it — same limitation the pre-existing per-item "add to
    // meal log" affordance already had before this screen was wired to the real Voice Agent.
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Confirmed — meal logging persistence is not wired up yet.')),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Voice Food Log')),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
            Text(
              'Hold the button and say what you ate',
              style: AppType.bodySmall.copyWith(color: context.colors.subtle),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 32),
            GestureDetector(
              onLongPressStart: (_) => _startListening(),
              onLongPressEnd:   (_) => _stopListening(),
              child: AnimatedContainer(
                duration: AppMotion.micro,
                width:  _listening ? 100 : 80,
                height: _listening ? 100 : 80,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: _listening ? Colors.red : context.colors.primary,
                  boxShadow: _listening
                      ? [BoxShadow(color: Colors.red.withValues(alpha: 0.4), blurRadius: 20, spreadRadius: 5)]
                      : [],
                ),
                child: Icon(
                  _listening ? Icons.mic : Icons.mic_none,
                  color: Colors.white,
                  size: 36,
                ),
              ),
            ),
            const SizedBox(height: 24),

            if (_transcript.isNotEmpty) ...[
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.grey.shade100,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  '"$_transcript"',
                  style: const TextStyle(fontStyle: FontStyle.italic),
                  textAlign: TextAlign.center,
                ),
              ),
              const SizedBox(height: 16),
            ],

            if (_processing) const AppLoader(),

            // Ambiguous — the Voice Agent asked ONE clarifying question rather than guessing.
            if (_ambiguous && _responseText != null) ...[
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: context.colors.warning.withAlpha(15),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: context.colors.warning.withAlpha(60)),
                ),
                child: Column(children: [
                  Text(_responseText!, textAlign: TextAlign.center),
                  const SizedBox(height: 8),
                  OutlinedButton.icon(
                    onPressed: _startListening,
                    icon: const Icon(Icons.mic),
                    label: const Text('Try again'),
                  ),
                ]),
              ),
            ],

            // Confirmable — a high-confidence food-logging parse, awaiting explicit confirmation.
            if (_pendingFoods.isNotEmpty && !_foodLogConfirmed) ...[
              Align(
                alignment: Alignment.centerLeft,
                child: Text('Did you have:', style: AppType.bodySmall.copyWith(color: context.colors.subtle)),
              ),
              const SizedBox(height: 8),
              Expanded(
                child: ListView.separated(
                  itemCount: _pendingFoods.length,
                  separatorBuilder: (_, __) => const Divider(height: 1),
                  itemBuilder: (_, i) {
                    final f = _pendingFoods[i];
                    final qty = f['quantity'] != null ? '${f['quantity']} ' : '';
                    final unit = f['unit'] != null ? '${f['unit']} of ' : '';
                    return ListTile(
                      leading: const Icon(Icons.restaurant),
                      title: Text((f['name'] as String?) ?? ''),
                      subtitle: Text('$qty$unit(said: "${f['nameRaw'] ?? f['name']}")'),
                    );
                  },
                ),
              ),
              const SizedBox(height: 8),
              FilledButton(onPressed: _confirmFoodLog, child: const Text('Confirm')),
            ],

            if (_foodLogConfirmed) ...[
              const SizedBox(height: 16),
              Icon(Icons.check_circle, color: context.colors.success, size: 32),
              const SizedBox(height: 8),
              const Text('Confirmed'),
            ],

            if (_responseText != null && !_ambiguous && _pendingFoods.isEmpty) ...[
              const SizedBox(height: 16),
              Text(_responseText!, textAlign: TextAlign.center),
            ],

            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(_error!, style: const TextStyle(color: Colors.red), textAlign: TextAlign.center),
            ],

            if (!_sttReady && !_listening) ...[
              const SizedBox(height: 8),
              Text(
                'Microphone permission required',
                style: AppType.bodySmall.copyWith(color: Colors.orange),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
