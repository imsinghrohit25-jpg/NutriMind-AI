package com.nutrimind.nutrimind

import io.flutter.embedding.android.FlutterFragmentActivity

// The health plugin uses registerForActivityResult when requesting Health Connect permissions,
// which requires the host Activity to be castable to androidx.activity.ComponentActivity —
// FlutterActivity doesn't satisfy that, FlutterFragmentActivity does (health plugin's own README,
// "Android 14" section). Without this, GeneratedPluginRegistrant fails to register the health
// plugin at all (ClassCastException at app startup), confirmed via a real on-device run.
class MainActivity : FlutterFragmentActivity()
