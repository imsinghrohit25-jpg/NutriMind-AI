# google_mlkit_text_recognition's plugin glue code (TextRecognizer.kt) references every optional
# script-specific recognizer (Chinese/Devanagari/Japanese/Korean) generically, since it dispatches
# by a runtime script parameter — but this app only depends on the base (Latin) text-recognition
# module (see pubspec.yaml: google_mlkit_text_recognition, no separate script-specific packages).
# R8's release-mode minification fails hard on these unresolved references unless told they're
# expected to be absent. Rules below are R8's own auto-generated suggestion from
# build/app/outputs/mapping/release/missing_rules.txt (found by actually running a release build).
-dontwarn com.google.mlkit.vision.text.chinese.ChineseTextRecognizerOptions$Builder
-dontwarn com.google.mlkit.vision.text.chinese.ChineseTextRecognizerOptions
-dontwarn com.google.mlkit.vision.text.devanagari.DevanagariTextRecognizerOptions$Builder
-dontwarn com.google.mlkit.vision.text.devanagari.DevanagariTextRecognizerOptions
-dontwarn com.google.mlkit.vision.text.japanese.JapaneseTextRecognizerOptions$Builder
-dontwarn com.google.mlkit.vision.text.japanese.JapaneseTextRecognizerOptions
-dontwarn com.google.mlkit.vision.text.korean.KoreanTextRecognizerOptions$Builder
-dontwarn com.google.mlkit.vision.text.korean.KoreanTextRecognizerOptions

# R8's optimizing minification breaks ML Kit's InputImage converter at RUNTIME in release builds:
# every camera frame/still failed with a bare NullPointerException inside the (obfuscated)
# converter (`ImageError: Getting Image failed` + `InputImageConverterError`), while the exact
# same code worked in debug — found by running the real release APK on a real device. ML Kit
# reaches parts of its own API reflectively, so shrinking must keep the whole surface. The
# barcode/text plugins don't ship consumer keep rules for this, hence app-level rules here.
-keep class com.google.mlkit.** { *; }
-keep class com.google.android.gms.internal.mlkit_vision_barcode.** { *; }
-keep class com.google.android.gms.internal.mlkit_vision_common.** { *; }
-keep class com.google.android.gms.internal.mlkit_vision_text_common.** { *; }
-keep class com.google.android.odml.image.** { *; }
