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
