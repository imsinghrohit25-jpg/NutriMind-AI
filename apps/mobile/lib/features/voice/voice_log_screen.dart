// Voice food logging — hold-to-record, STT via platform speech_to_text,
// then sends transcription to /api/v1/voice/parse, plays TTS response.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:speech_to_text/speech_to_text.dart';
import 'package:flutter_tts/flutter_tts.dart';
import '../../core/design_system/tokens.dart';
import '../../core/network/api_client.dart';

class VoiceLogScreen extends ConsumerStatefulWidget {
  const VoiceLogScreen({super.key});

  @override
  ConsumerState<VoiceLogScreen> createState() => _VoiceLogScreenState();
}

class _VoiceLogScreenState extends ConsumerState<VoiceLogScreen> {
  final SpeechToText _stt    = SpeechToText();
  final FlutterTts   _tts    = FlutterTts();
  bool   _sttReady   = false;
  bool   _listening  = false;
  bool   _processing = false;
  String _transcript = '';
  List<_ParsedFood> _parsedFoods = [];
  String? _ttsText;
  String? _error;

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
    _stt.stop();
    _tts.stop();
    super.dispose();
  }

  Future<void> _startListening() async {
    if (!_sttReady || _listening) return;
    setState(() { _transcript = ''; _parsedFoods = []; _ttsText = null; _error = null; });
    await _stt.listen(
      onResult: (r) {
        if (mounted) setState(() => _transcript = r.recognizedWords);
        if (r.finalResult) _sendToNlu(r.recognizedWords);
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
    if (_transcript.isNotEmpty && _parsedFoods.isEmpty && !_processing) {
      _sendToNlu(_transcript);
    }
  }

  Future<void> _sendToNlu(String text) async {
    if (text.trim().isEmpty) return;
    setState(() { _processing = true; _error = null; });
    try {
      final api  = ref.read(apiClientProvider);
      final resp = await api.post<Map<String, dynamic>>(
        '/api/v1/voice/parse',
        data: {'text': text},
      );
      final nlu    = resp.data?['nlu']  as Map<String, dynamic>? ?? {};
      final ttsMap = resp.data?['tts']  as Map<String, dynamic>? ?? {};
      final foods  = (nlu['foods'] as List<dynamic>? ?? []).map((f) {
        final m = f as Map<String, dynamic>;
        return _ParsedFood(
          name:    m['name'] as String? ?? '',
          nameRaw: m['nameRaw'] as String? ?? '',
          quantity:m['quantity'] as num?,
          unit:    m['unit'] as String?,
        );
      }).toList();

      if (mounted) {
        setState(() {
          _parsedFoods = foods;
          _ttsText     = ttsMap['text'] as String?;
          _processing  = false;
        });
      }

      if (ttsMap['text'] != null) {
        final lang = ttsMap['lang'] as String? ?? 'en-IN';
        await _tts.setLanguage(lang);
        await _tts.speak(ttsMap['text'] as String);
      }
    } catch (e) {
      if (mounted) setState(() { _error = e.toString(); _processing = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Voice Food Log')),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
            // Instruction
            Text(
              'Hold the button and say what you ate',
              style: AppType.bodySmall.copyWith(color: AppColors.subtle),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 32),

            // Mic button
            GestureDetector(
              onLongPressStart: (_) => _startListening(),
              onLongPressEnd:   (_) => _stopListening(),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                width:  _listening ? 100 : 80,
                height: _listening ? 100 : 80,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: _listening ? Colors.red : AppColors.primary,
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

            // Transcript
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

            // Processing
            if (_processing)
              const CircularProgressIndicator(),

            // Parsed foods
            if (_parsedFoods.isNotEmpty) ...[
              Align(
                alignment: Alignment.centerLeft,
                child: Text('Recognised:', style: AppType.bodySmall.copyWith(color: AppColors.subtle)),
              ),
              const SizedBox(height: 8),
              Expanded(
                child: ListView.separated(
                  itemCount: _parsedFoods.length,
                  separatorBuilder: (_, __) => const Divider(height: 1),
                  itemBuilder: (_, i) {
                    final f = _parsedFoods[i];
                    final qty = f.quantity != null ? '${f.quantity} ' : '';
                    final unit = f.unit != null ? '${f.unit} of ' : '';
                    return ListTile(
                      leading: const Icon(Icons.restaurant),
                      title:    Text(f.name),
                      subtitle: Text('$qty$unit(said: "${f.nameRaw}")'),
                      trailing: IconButton(
                        icon: const Icon(Icons.add_circle_outline),
                        onPressed: () {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(content: Text('${f.name} added to meal log')),
                          );
                        },
                      ),
                    );
                  },
                ),
              ),
            ],

            // TTS text
            if (_ttsText != null && _parsedFoods.isEmpty) ...[
              const SizedBox(height: 16),
              Text(_ttsText!, textAlign: TextAlign.center),
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

class _ParsedFood {
  const _ParsedFood({
    required this.name, required this.nameRaw,
    this.quantity, this.unit,
  });
  final String  name, nameRaw;
  final num?    quantity;
  final String? unit;
}
