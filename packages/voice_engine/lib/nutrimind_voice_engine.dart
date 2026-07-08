/// NutriMind Voice Engine — STT routing decision + wake-word availability metadata (Phase 6).
/// STT transcription and TTS synthesis both happen client-side (mirrors
/// `apps/api/src/voice/{stt-router,tts}.ts`'s stated scope) — this package carries only the
/// *decisions* (which engine to use, whether wake-word is available) computed server-side-
/// equivalently, same single-source-of-truth pattern as `nutrimind_grocery_providers`
/// (ADR-0018 §1) and `nutrimind_ocr_engine`.
library nutrimind_voice_engine;

export 'src/stt_strategy.dart';
export 'src/wake_word_info.dart';
