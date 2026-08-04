const { withAndroidManifest } = require('@expo/config-plugins');

// Plugin inline : ajoute usesCleartextTraffic="false" au manifest release.
// Le debug manifest override via tools:replace — le dev n'est pas affecté.
const withNoHttpCleartext = config =>
  withAndroidManifest(config, async androidConfig => {
    const app = androidConfig.modResults.manifest.application?.[0];
    if (app) app.$['android:usesCleartextTraffic'] = 'false';
    return androidConfig;
  });

module.exports = withNoHttpCleartext({
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
      image: "./assets/icon/lassi-radar-base.png",
      resizeMode: "contain",
      backgroundColor: "#14152A",
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.lassiapp.lassiapp",
      infoPlist: {
        NSLocationWhenInUseUsageDescription:
          "LASSİ utilise ta position pour te montrer les commerces autour de toi.",
        NSLocationAlwaysAndWhenInUseUsageDescription:
          "LASSİ utilise ta position pour te montrer les commerces autour de toi.",
        NSCameraUsageDescription:
          "LASSİ accède à ta caméra pour scanner les QR codes de réservation terrain.",
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
            "LASSİ accède à ta caméra pour scanner les QR codes de réservation terrain.",
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
            "LASSİ accède à ta caméra pour photographier tes produits.",
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
