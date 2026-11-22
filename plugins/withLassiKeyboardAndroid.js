const {
  withDangerousMod,
  withAndroidManifest,
  AndroidConfig,
} = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

// Config-plugin : injecte le clavier vendeur LASSI (InputMethodService) dans le
// module app Android pendant le prebuild EAS (côté serveur). On n'utilise PAS de
// module Expo local pour Android : le code Kotlin est écrit directement dans
// android/app → compilé avec l'app (fiable, immunisé contre les soucis de
// source-set des modules locaux). Les données marchand sont lues depuis
// filesDir/lassi_keyboard.json (écrit par l'app via expo-file-system).

const SRC_DIR = path.join(__dirname, 'lassi-keyboard-android');

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

const withSources = config =>
  withDangerousMod(config, [
    'android',
    async cfg => {
      const appMain = path.join(cfg.modRequest.platformProjectRoot, 'app', 'src', 'main');
      copyFile(
        path.join(SRC_DIR, 'java', 'tech', 'lassi', 'keyboard', 'LassiKeyboardService.kt'),
        path.join(appMain, 'java', 'tech', 'lassi', 'keyboard', 'LassiKeyboardService.kt'),
      );
      copyFile(
        path.join(SRC_DIR, 'res', 'xml', 'method.xml'),
        path.join(appMain, 'res', 'xml', 'method.xml'),
      );
      return cfg;
    },
  ]);

const withService = config =>
  withAndroidManifest(config, cfg => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);
    app.service = app.service || [];
    const name = 'tech.lassi.keyboard.LassiKeyboardService';
    if (!app.service.some(s => s.$?.['android:name'] === name)) {
      app.service.push({
        $: {
          'android:name': name,
          'android:label': 'Clavier LASSI',
          'android:permission': 'android.permission.BIND_INPUT_METHOD',
          'android:exported': 'true',
        },
        'intent-filter': [{ action: [{ $: { 'android:name': 'android.view.InputMethod' } }] }],
        'meta-data': [{ $: { 'android:name': 'android.view.im', 'android:resource': '@xml/method' } }],
      });
    }
    return cfg;
  });

module.exports = config => withService(withSources(config));
