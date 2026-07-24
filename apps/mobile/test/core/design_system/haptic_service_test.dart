import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nutrimind/core/design_system/haptic_service.dart';

/// Verifies HapticService actually gates the platform haptic channel: when [enabled] is false no
/// `HapticFeedback` platform call is emitted, and when true the expected impact is emitted. We spy
/// on the real `SystemChannels.platform` method channel rather than mocking HapticFeedback.
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  final calls = <String>[];

  setUp(() {
    calls.clear();
    HapticService.enabled = true;
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(SystemChannels.platform, (call) async {
      if (call.method == 'HapticFeedback.vibrate') calls.add(call.arguments as String? ?? 'default');
      return null;
    });
  });

  tearDown(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(SystemChannels.platform, null);
  });

  test('emits the platform haptic when enabled', () async {
    HapticService.medium();
    await Future<void>.delayed(Duration.zero);
    expect(calls, isNotEmpty);
  });

  test('emits nothing when globally disabled', () async {
    HapticService.enabled = false;
    HapticService.medium();
    HapticService.heavy();
    HapticService.selection();
    HapticService.warning();
    await Future<void>.delayed(Duration.zero);
    expect(calls, isEmpty);
  });

  test('semantic aliases map to platform impacts (heavy for warning/error)', () async {
    HapticService.warning();
    HapticService.error();
    await Future<void>.delayed(Duration.zero);
    expect(calls, hasLength(2));
    expect(calls.every((c) => c.contains('heavy')), isTrue);
  });
}
