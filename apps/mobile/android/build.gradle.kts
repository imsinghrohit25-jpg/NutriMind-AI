allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

// Some plugins (e.g. `health`, whose vendored android/build.gradle hardcodes `compileSdk 34`)
// declare a lower compileSdk than their own transitive dependencies require
// (androidx.health.connect:connect-client needs 35+), which fails AAR metadata checks on any
// Android build. Force every library subproject to compile against at least Flutter's own
// default (36) regardless of what the plugin's own build.gradle declares, rather than patching
// vendored plugin source or bumping the plugin's Dart-facing major version.
subprojects {
    plugins.withId("com.android.library") {
        extensions.configure<com.android.build.gradle.LibraryExtension> {
            if ((compileSdk ?: 0) < 36) {
                compileSdk = 36
            }
        }
    }
}

val newBuildDir: Directory =
    rootProject.layout.buildDirectory
        .dir("../../build")
        .get()
rootProject.layout.buildDirectory.value(newBuildDir)

subprojects {
    val newSubprojectBuildDir: Directory = newBuildDir.dir(project.name)
    project.layout.buildDirectory.value(newSubprojectBuildDir)
}
subprojects {
    project.evaluationDependsOn(":app")
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}
