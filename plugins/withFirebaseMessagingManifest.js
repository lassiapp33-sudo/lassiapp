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

    return config;
  });
};
