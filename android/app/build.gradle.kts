import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

// CI passes the keystore in from repository secrets; a local build reads ~/.config/margin.
val signing = Properties().apply {
    val ciStore = System.getenv("MARGIN_KEYSTORE_FILE")
    if (!ciStore.isNullOrEmpty()) {
        val password = System.getenv("MARGIN_KEYSTORE_PASSWORD").orEmpty()
        setProperty("storeFile", ciStore)
        setProperty("storePassword", password)
        setProperty("keyAlias", "margin")
        setProperty("keyPassword", password)
    } else {
        val file = File(System.getProperty("user.home"), ".config/margin/keystore.properties")
        if (file.exists()) file.inputStream().use { load(it) }
    }
}

fun git(vararg args: String): String =
    providers.exec { commandLine("git", *args) }.standardOutput.asText.get().trim()

// One versionCode source for CI and local builds: seconds from 2026-01-01 UTC to
// the HEAD commit's committer time, so a later merge always outranks an earlier build.
val buildNumber = (git("log", "-1", "--format=%ct").toLong() - 1_767_225_600L).toInt()

android {
    namespace = "com.anurag.margin"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.anurag.margin"
        minSdk = 29
        targetSdk = 35
        versionCode = buildNumber
        versionName = "1.$buildNumber"
    }

    signingConfigs {
        create("release") {
            if (signing.isNotEmpty()) {
                storeFile = File(signing.getProperty("storeFile"))
                storePassword = signing.getProperty("storePassword")
                keyAlias = signing.getProperty("keyAlias")
                keyPassword = signing.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"))
            signingConfig = signingConfigs.getByName("release")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        compose = true
    }
    testOptions {
        unitTests.isReturnDefaultValues = true
    }
}

dependencies {
    implementation(platform("androidx.compose:compose-bom:2024.12.01"))
    implementation("androidx.activity:activity-compose:1.9.3")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.foundation:foundation")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    debugImplementation("androidx.compose.ui:ui-tooling")
    implementation("androidx.compose.ui:ui-tooling-preview")

    testImplementation("junit:junit:4.13.2")
    testImplementation("org.json:json:20240303")
}
