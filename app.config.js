const { withAndroidManifest, withGradleProperties } = require('@expo/config-plugins');

// Plugin 1 : usesCleartextTraffic="false" au manifest release.
// Le debug manifest override via tools:replace — le dev n'est pas affecté.
const withNoHttpCleartext = config =>
  withAndroidManifest(config, async androidConfig => {
    const app = androidConfig.modResults.manifest.application?.[0];
    if (app) app.$['android:usesCleartextTraffic'] = 'false';
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

const withSecurityPlugins = config => withR8Release(withNoHttpCleartext(config));

module.exports = withSecurityPlugins({
  expo: {
    name: "LASSI",
    slug: "LassiApp",
    scheme: "lassiapp",
    version: "1.0.0",
    orientation: "portrait",
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
      supportsTablet: true,
      bundleIdentifier: "com.lassiapp.lassiapp",
      googleServicesFile:
        process.env.GOOGLE_SERVICES_IOS_PLIST ?? "./GoogleService-Info.plist",
      infoPlist: {
        NSLocationWhenInUseUsageDescription:
          "LASSİ utilise ta position pour te montrer les commerces autour de toi.",
        NSMicrophoneUsageDescription:
          "LASSİ utilise le micro pour enregistrer un message vocal joint à ta commande.",
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#14152A",
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
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
        "expo-camera",
        {
          cameraPermission:
            "LASSİ accède à ta caméra pour scanner les QR codes de réservation et photographier tes produits.",
        },
      ],
      [
        "expo-location",
        {
          locationWhenInUsePermission:
            "LASSİ utilise ta position pour te montrer les commerces autour de toi.",
        },
      ],
      [
        "expo-image-picker",
        {
          photosPermission:
            "LASSİ accède à ta galerie pour ajouter des photos de produits.",
          cameraPermission:
            "LASSİ accède à ta caméra pour scanner les QR codes de réservation et photographier tes produits.",
        },
      ],
      [
        "expo-media-library",
        {
          photosPermission:
            "LASSİ accède à ta galerie pour ajouter des photos de produits et sauvegarder les images reçues dans le chat.",
          savePhotosPermission:
            "LASSİ sauvegarde les images reçues dans ta galerie.",
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
