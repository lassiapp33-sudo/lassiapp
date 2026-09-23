const { withAndroidManifest } = require('@expo/config-plugins');

// Fix conflit manifest merger : react-native-firebase/messaging définit
// default_notification_color=@color/white, notre app définit @color/notification_icon_color.
// Gradle refuse de merger sans tools:replace explicite.
module.exports = function withFirebaseMessagingManifest(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;

    // Ajouter xmlns:tools si absent
    if (!manifest.$['xmlns:tools']) {
      manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    }

    const app = manifest.application?.[0];
    if (!app) return config;

    if (!Array.isArray(app['meta-data'])) app['meta-data'] = [];

    const colorMeta = app['meta-data'].find(
      (m) => m.$?.['android:name'] === 'com.google.firebase.messaging.default_notification_color'
    );

    if (colorMeta) {
      colorMeta.$['tools:replace'] = 'android:resource';
    }

    // Canal de notification par défaut Firebase Messaging.
    // Sans ça, les notifs FCM affichées par Firebase en arrière-plan tombent sur
    // fcm_fallback_notification_channel (importance LOW → MUET, confirmé via
    // `adb dumpsys notification`: naturalImportance=2, sound=null). On force le
    // canal 'commandes-v2' (créé au boot dans App.tsx, importance MAX + son).
    const CH_KEY = 'com.google.firebase.messaging.default_notification_channel_id';
    const chMeta = app['meta-data'].find((m) => m.$?.['android:name'] === CH_KEY);
    if (chMeta) chMeta.$['android:value'] = 'commandes-v2';
    else app['meta-data'].push({ $: { 'android:name': CH_KEY, 'android:value': 'commandes-v2' } });

    return config;
  });
};
