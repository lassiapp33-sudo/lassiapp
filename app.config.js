const { withAndroidManifest, withGradleProperties } = require('@expo/config-plugins');

// Plugin 1 : usesCleartextTraffic="false" au manifest release.
// Le debug manifest override via tools:replace — le dev n'est pas affecté.
const withNoHttpCleartext = config =>
  withAndroidManifest(config, async androidConfig => {
    const app = androidConfig.modResults.manifest.application?.[0];
    if (app) app.$['android:usesCleartextTraffic'] = 'false';
    return androidConfig;
  });

// Plugin 3 : Compatibilité grands écrans Android 15.
// Google Play exige l'absence de screenOrientation dans le manifest.
// On verrouille le portrait au runtime via expo-screen-orientation (index.ts).
// tools:remove retire l'attribut ajouté par la lib ML Kit lors du merge Gradle.
const withLargeScreenCompat = config =>
  withAndroidManifest(config, async androidConfig => {
    const manifest = androidConfig.modResults.manifest;
    if (!manifest.$['xmlns:tools']) {
      manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    }
    const activities = manifest.application?.[0]?.activity ?? [];
    const mlkitName = 'com.google.mlkit.vision.codescanner.internal.GmsBarcodeScanningDelegateActivity';
    const existing = activities.find(a => a.$?.['android:name'] === mlkitName);
    if (existing) {
      existing.$['tools:remove'] = 'android:screenOrientation';
      delete existing.$['android:screenOrientation'];
    } else {
      activities.push({ $: { 'android:name': mlkitName, 'tools:remove': 'android:screenOrientation' } });
      manifest.application[0].activity = activities;
    }
    return androidConfig;
  });

// Plugin 2 : R8 minification + resource shrinking activés pour le build release.
// Réduit la taille de l'APK/AAB et obfusque les noms de classes Java/Kotlin.
// Testé avec les règles ProGuard incluses par les modules natifs (AAR).
const withR8Release = config =>
  withGradleProperties(config, props => {
    const set = (key, value) => {
      const idx = props.findIndex(p => p.type === 'property' && p.key === key);
      if (idx >= 0) props[idx].value = value;
      else props.push({ type: 'property', key, value });
    };
    set('android.enableMinifyInReleaseBuilds', 'true');
    set('android.enableShrinkResourcesInReleaseBuilds', 'true');
    return props;
  });


const withSecurityPlugins = config => withLargeScreenCompat(withR8Release(withNoHttpCleartext(config)));

module.exports = withSecurityPlugins({
  expo: {
    name: "LASSI",
    slug: "LassiApp",
    scheme: "lassiapp",
    version: "1.0.1",
    orientation: "default",
    updates: {
      url: "https://u.expo.dev/e9058ef3-df10-43e4-af04-6830a98025e9",
      enabled: true,
      checkAutomatically: "ON_LOAD",
      fallbackToCacheTimeout: 0,
    },
    runtimeVersion: {
      policy: "appVersion",
    },
    icon: "./assets/icon.png",
    userInterfaceStyle: "dark",
    newArchEnabled: false,
    splash: {
      backgroundColor: "#14152A",
    },
    ios: {
      supportsTablet: false,
      bundleIdentifier: "com.lassiapp.lassiapp",
      googleServicesFile:
        process.env.GOOGLE_SERVICES_IOS_PLIST ?? "./GoogleService-Info.plist",
      infoPlist: {
        NSLocationWhenInUseUsageDescription:
          "LASSİ utilise ta position pour afficher les commerces et prestataires proches de toi (ex. : voir les restaurants à 500 m sur la carte) et pour te guider en navigation GPS jusqu'au prestataire sélectionné.",
        NSMicrophoneUsageDescription:
          "LASSİ utilise le microphone pour enregistrer des messages vocaux dans le chat (ex. : dicter les détails d'une commande à un prestataire) et pour enregistrer un commentaire vocal lors d'un avis client.",
        NSCameraUsageDescription:
          "LASSİ utilise ta caméra pour photographier tes produits (ex. : prendre la photo d'un plat pour l'ajouter à ta vitrine), scanner les QR codes de réservation présentés par les clients, numériser ton menu papier et prendre des photos à partager dans le chat.",
        NSPhotoLibraryUsageDescription:
          "LASSİ accède à ta bibliothèque de photos pour sélectionner des images de produits (ex. : choisir la photo d'un article pour ta vitrine marchande ou ton profil) et partager des images dans la messagerie avec tes clients ou prestataires.",
        NSPhotoLibraryAddUsageDescription:
          "LASSİ enregistre dans ta bibliothèque les images reçues dans tes conversations. Exemple : sauvegarder la photo d'un produit envoyée par un prestataire dans le chat.",
        ITSAppUsesNonExemptEncryption: false,
        // Sans FirebaseMessaging, GULAppDelegateSwizzler avale didRegisterForRemoteNotificationsWithDeviceToken → getDevicePushTokenAsync ne résout jamais.
        FirebaseAppDelegateProxyEnabled: false,
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#14152A",
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      enableProguardInReleaseBuilds: true,
      extraProguardRules: "-keep class com.lassiapp.** { *; }",
      package: "com.lassiapp.lassiapp",
      googleServicesFile:
        process.env.GOOGLE_SERVICES_JSON ?? "./google-services.json",
      permissions: [
        "android.permission.RECORD_AUDIO",
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.ACCESS_COARSE_LOCATION",
        "android.permission.POST_NOTIFICATIONS",
        "android.permission.CAMERA",
      ],
    },
    web: {
      favicon: "./assets/favicon.png",
    },
    plugins: [
      "@react-native-firebase/app",
      "@react-native-firebase/crashlytics",
      "expo-font",
      [
        "expo-splash-screen",
        {
          backgroundColor: "#14152A",
          drawable: { icon: "./assets/splash_blank.xml" },
        },
      ],
      [
        "expo-camera",
        {
          cameraPermission:
            "LASSİ utilise ta caméra pour photographier tes produits (ex. : prendre la photo d'un plat pour l'ajouter à ta vitrine), scanner les QR codes de réservation présentés par les clients, numériser ton menu papier et prendre des photos à partager dans le chat.",
        },
      ],
      [
        "expo-location",
        {
          locationWhenInUsePermission:
            "LASSİ utilise ta position pour afficher les commerces et prestataires proches de toi (ex. : voir les restaurants à 500 m sur la carte) et pour te guider en navigation GPS jusqu'au prestataire sélectionné.",
        },
      ],
      [
        "expo-image-picker",
        {
          photosPermission:
            "LASSİ accède à ta bibliothèque de photos pour sélectionner des images de produits (ex. : choisir la photo d'un article pour ta vitrine marchande ou ton profil) et partager des images dans la messagerie avec tes clients ou prestataires.",
          cameraPermission:
            "LASSİ utilise ta caméra pour photographier tes produits (ex. : prendre la photo d'un plat pour l'ajouter à ta vitrine), scanner les QR codes de réservation présentés par les clients, numériser ton menu papier et prendre des photos à partager dans le chat.",
        },
      ],
      [
        "expo-media-library",
        {
          photosPermission:
            "LASSİ accède à ta bibliothèque de photos pour sélectionner des images de produits (ex. : choisir la photo d'un article pour ta vitrine marchande ou ton profil) et partager des images dans la messagerie avec tes clients ou prestataires.",
          savePhotosPermission:
            "LASSİ enregistre dans ta bibliothèque les images reçues dans tes conversations. Exemple : sauvegarder la photo d'un produit envoyée par un prestataire dans le chat.",
          isAccessMediaLocationEnabled: false,
        },
      ],
      [
        "expo-notifications",
        {
          icon: "./assets/icon.png",
          color: "#14152A",
          sounds: [],
        },
      ],
      "expo-secure-store",
      [
        "expo-build-properties",
        {
          ios: {
            deploymentTarget: "16.0",
            useFrameworks: "static",
          },
        },
      ],
    ],
    extra: {
      eas: {
        projectId: "e9058ef3-df10-43e4-af04-6830a98025e9",
      },
      privacyPolicyUrl:
        "https://lassiapp33-sudo.github.io/lassiapp/privacy-policy.html",
    },
    owner: "lassiapp",
  },
});
