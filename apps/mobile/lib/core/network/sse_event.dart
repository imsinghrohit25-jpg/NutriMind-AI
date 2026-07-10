import 'dart:convert';

/// One real Server-Sent-Events frame from the backend (apps/api/src/agents/sse.ts) —
/// `event: <type>\ndata: <json>\n\n`. Parsed as-is, never fabricated or re-chunked client-side.
class SseEvent {
  const SseEvent(this.type, this.data);

  final String type;
  final dynamic data;

  /// Parses one frame (already split on the blank-line frame separator). Returns null for a
  /// malformed frame (missing `event:` line) rather than guessing a type.
  static SseEvent? parse(String frame) {
    String? type;
    final dataLines = <String>[];

    for (final line in frame.split('\n')) {
      if (line.startsWith('event:')) {
        type = line.substring(6).trim();
      } else if (line.startsWith('data:')) {
        dataLines.add(line.substring(5).trim());
      }
    }

    if (type == null) return null;

    final raw = dataLines.join('\n');
    dynamic data;
    try {
      data = raw.isEmpty ? null : jsonDecode(raw);
    } catch (_) {
      data = raw; // non-JSON payload — pass the raw string through rather than dropping it
    }
    return SseEvent(type, data);
  }
}
