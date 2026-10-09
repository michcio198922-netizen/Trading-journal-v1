plugins {
    id("com.android.application")
}

android {
    namespace = "pl.smcjournal.app"
    compileSdk = 36

    defaultConfig {
        applicationId = "pl.smcjournal.app"
        minSdk = 26
        targetSdk = 36
        versionCode = 4
        versionName = "4.0"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}
