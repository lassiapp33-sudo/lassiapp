const { withAndroidManifest, withGradleProperties } = require('@expo/config-plugins');

// Plugin 1 : usesCleartextTraffic="false" au manifest release.
// Le debug manifest override via tools:replace Ã¢â‚¬â€ le dev n'est pas affectÃƒÂ©.
const withNoHttpCleartext = config =>
  withAndroidManifest(config, async androidConfig => {
    const app = androidConfig.modResults.manifest.application?.[0];
    if (app) app.$['android:usesCleartextTraffic'] = 'false';
    return androidConfig;
  });

// Plugin 3 : CompatibilitÃƒÂ© grands ÃƒÂ©crans Android 15.
// Google Play exige l'absence de screenOrientation dans le manifest.
// On verrouille le portrait au runtime via expo-screen-orientation (index.ts).
// tools:remove retire l'attribut ajoutÃƒÂ© par la lib ML Kit lors du merge Gradle.
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

// Plugin 2 : R8 minification + resource shrinking activÃƒÂ©s pour le build release.
// RÃƒÂ©duit la taille de l'APK/AAB et obfusque les noms de classes Java/Kotlin.
// TestÃƒÂ© avec les rÃƒÂ¨gles ProGuard incluses par les modules natifs (AAR).
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


// Retire READ_MEDIA_IMAGES et READ_MEDIA_VIDEO ajoutÃƒÂ©s par expo-media-library.
// L'app utilise le Photo Picker Android (launchImageLibraryAsync) qui n'a pas
// besoin de ces permissions larges. saveToLibraryAsync fonctionne sans sur API 29+.
const withBlockedMediaPermissions = config =>
  withAndroidManifest(config, androidConfig => {
    const BLOCKED = [
      'android.permission.READ_MEDIA_IMAGES',
      'android.permission.READ_MEDIA_VIDEO',
    ];
    const perms = androidConfig.modResults.manifest['uses-permission'] ?? [];
    androidConfig.modResults.manifest['uses-permission'] = perms.filter(
      p => !BLOCKED.includes(p.$['android:name'])
    );
    return androidConfig;
  });

// NOTE: le canal Firebase par dÃƒÂ©faut (commandes-v2) est injectÃƒÂ© via
// ./plugins/withFirebaseMessagingManifest (tableau `plugins`), PAS ici : les mods
// de withSecurityPlugins ne s'appliquent pas (l'export enveloppe {expo:{...}} Ã¢â€ â€™
// Expo lit .expo et perd les mods attachÃƒÂ©s au niveau wrapper).
const withSecurityPlugins = config =>
  withBlockedMediaPermissions(withLargeScreenCompat(withR8Release(withNoHttpCleartext(config))));

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
      appleTeamId: "8DH7238995",
      googleServicesFile:
        process.env.GOOGLE_SERVICES_IOS_PLIST ?? "./GoogleService-Info.plist",
      entitlements: {
        "aps-environment": "production",
        "com.apple.developer.associated-domains": ["applinks:lassi.tech"],
      },
      infoPlist: {
        UIBackgroundModes: ["remote-notification"],
        // Swizzling Firebase LAISSÃƒâ€° ACTIF (proxy par dÃƒÂ©faut). Avec useFrameworks:static,
        // le subscriber APNs natif d'expo-notifications ne reÃƒÂ§oit jamais
        // didRegisterForRemoteNotificationsWithDeviceToken (ni didRegister ni didFail Ã¢â€ â€™ hang).
        // Le SEUL mÃƒÂ©canisme qui capte l'APNs token est le swizzling Firebase. iOS passe donc
        // par la route FCM (Firebase getToken Ã¢â€ â€™ Expo Push type fcm), comme Android.
        NSLocationWhenInUseUsageDescription:
          "LASSÃ„Â° utilise ta position pour afficher les commerces et prestataires proches de toi (ex. : voir les restaurants ÃƒÂ  500 m sur la carte) et pour te guider en navigation GPS jusqu'au prestataire sÃƒÂ©lectionnÃƒÂ©.",
        NSMicrophoneUsageDescription:
          "LASSÃ„Â° utilise le microphone pour enregistrer des messages vocaux dans le chat (ex. : dicter les dÃƒÂ©tails d'une commande ÃƒÂ  un prestataire) et pour enregistrer un commentaire vocal lors d'un avis client.",
        NSCameraUsageDescription:
          "LASSÃ„Â° utilise ta camÃƒÂ©ra pour photographier tes produits (ex. : prendre la photo d'un plat pour l'ajouter ÃƒÂ  ta vitrine), scanner les QR codes de rÃƒÂ©servation prÃƒÂ©sentÃƒÂ©s par les clients, numÃƒÂ©riser ton menu papier et prendre des photos ÃƒÂ  partager dans le chat.",
        NSPhotoLibraryUsageDescription:
          "LASSÃ„Â° accÃƒÂ¨de ÃƒÂ  ta bibliothÃƒÂ¨que de photos pour sÃƒÂ©lectionner des images de produits (ex. : choisir la photo d'un article pour ta vitrine marchande ou ton profil) et partager des images dans la messagerie avec tes clients ou prestataires.",
        NSPhotoLibraryAddUsageDescription:
          "LASSÃ„Â° enregistre dans ta bibliothÃƒÂ¨que les images reÃƒÂ§ues dans tes conversations. Exemple : sauvegarder la photo d'un produit envoyÃƒÂ©e par un prestataire dans le chat.",
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
      // App Links : ouvre LASSI direct (sans prompt navigateur) pour le retour
      // paiement https://lassi.tech/paiement/*. NÃƒÂ©cessite assetlinks.json sur lassi.tech
      // avec l'empreinte SHA-256 de la clÃƒÂ© de signature Play.
      intentFilters: [
        {
          action: "VIEW",
          autoVerify: true,
          data: [
            { scheme: "https", host: "lassi.tech", pathPrefix: "/paiement" },
            { scheme: "https", host: "lassi.tech", pathPrefix: "/p" },
          ],
          category: ["BROWSABLE", "DEFAULT"],
        },
      ],
    },
    web: {
      favicon: "./assets/favicon.png",
    },
    plugins: [
      "@react-native-firebase/app",
      "@react-native-firebase/crashlytics",
      "@react-native-firebase/messaging",
      "./plugins/withFirebaseMessagingManifest",
      "./plugins/withCustomFirebaseMessaging",
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
            "LASSÃ„Â° utilise ta camÃƒÂ©ra pour photographier tes produits (ex. : prendre la photo d'un plat pour l'ajouter ÃƒÂ  ta vitrine), scanner les QR codes de rÃƒÂ©servation prÃƒÂ©sentÃƒÂ©s par les clients, numÃƒÂ©riser ton menu papier et prendre des photos ÃƒÂ  partager dans le chat.",
        },
      ],
      [
        "expo-location",
        {
          locationWhenInUsePermission:
            "LASSÃ„Â° utilise ta position pour afficher les commerces et prestataires proches de toi (ex. : voir les restaurants ÃƒÂ  500 m sur la carte) et pour te guider en navigation GPS jusqu'au prestataire sÃƒÂ©lectionnÃƒÂ©.",
        },
      ],
      [
        "expo-image-picker",
        {
          photosPermission:
            "LASSÃ„Â° accÃƒÂ¨de ÃƒÂ  ta bibliothÃƒÂ¨que de photos pour sÃƒÂ©lectionner des images de produits (ex. : choisir la photo d'un article pour ta vitrine marchande ou ton profil) et partager des images dans la messagerie avec tes clients ou prestataires.",
          cameraPermission:
            "LASSÃ„Â° utilise ta camÃƒÂ©ra pour photographier tes produits (ex. : prendre la photo d'un plat pour l'ajouter ÃƒÂ  ta vitrine), scanner les QR codes de rÃƒÂ©servation prÃƒÂ©sentÃƒÂ©s par les clients, numÃƒÂ©riser ton menu papier et prendre des photos ÃƒÂ  partager dans le chat.",
        },
      ],
      [
        "expo-media-library",
        {
          photosPermission:
            "LASSÃ„Â° accÃƒÂ¨de ÃƒÂ  ta bibliothÃƒÂ¨que de photos pour sÃƒÂ©lectionner des images de produits (ex. : choisir la photo d'un article pour ta vitrine marchande ou ton profil) et partager des images dans la messagerie avec tes clients ou prestataires.",
          savePhotosPermission:
            "LASSÃ„Â° enregistre dans ta bibliothÃƒÂ¨que les images reÃƒÂ§ues dans tes conversations. Exemple : sauvegarder la photo d'un produit envoyÃƒÂ©e par un prestataire dans le chat.",
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
















