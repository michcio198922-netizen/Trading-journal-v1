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
        versionCode = 8
        versionName = "5.2"
    }

    signingConfigs {
        create("release") {
            val signingPath = System.getenv("SMC_KEYSTORE_PATH")
            if (!signingPath.isNullOrBlank()) {
                storeFile = file(signingPath)
                storePassword = "SMCJournalUpdate2026"
                keyAlias = "smcjournal"
                keyPassword = "SMCJournalUpdate2026"
            }
        }
    }

    buildTypes {
        getByName("release") {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("release")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}
