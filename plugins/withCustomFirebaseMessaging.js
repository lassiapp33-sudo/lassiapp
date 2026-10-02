const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');
const path = require('path');
const fs   = require('fs');

// Étend ReactNativeFirebaseMessagingService pour supprimer les clés
// "notification" de l'intent AVANT que Firebase ne les affiche automatiquement.
// Sans ça : Firebase crée une notif silencieuse FCM-Notification:XXX en background
// ET notre BGHandler en crée une seconde avec son → doublon dans le tiroir.
// Avec ça : Firebase voit un message data-only → pas d'auto-affichage.
//           Notre BGHandler reçoit toujours le message et affiche la notif avec son.
const KOTLIN = `package com.lassiapp.lassiapp

import android.content.Intent
import android.os.Bundle
import io.invertase.firebase.messaging.ReactNativeFirebaseMessagingService

class CustomFirebaseMessagingService : ReactNativeFirebaseMessagingService() {

    // Clés ajoutées par FCM pour l'affichage automatique des notifications.
    // On les retire avant d'appeler super pour que Firebase ne crée pas de
    // notification silencieuse. Notre BGHandler (index.ts) prend le relais.
    private val NOTIFICATION_KEYS = listOf(
        "gcm.notification.title",
        "gcm.notification.body",
        "gcm.notification.sound",
        "gcm.notification.android_channel_id",
        "gcm.notification.icon",
        "gcm.notification.color",
        "gcm.notification.click_action",
        "gcm.notification.tag",
        "google.c.a.e",
    )

    override fun handleIntent(intent: Intent?) {
        if (intent == null) { super.handleIntent(null); return }

        val bundle = intent.extras?.let { Bundle(it) }
        if (bundle != null && NOTIFICATION_KEYS.any { bundle.containsKey(it) }) {
            NOTIFICATION_KEYS.forEach { bundle.remove(it) }
            val stripped = Intent(intent).apply { replaceExtras(bundle) }
            super.handleIntent(stripped)
        } else {
            super.handleIntent(intent)
        }
    }
}
`;

module.exports = function withCustomFirebaseMessaging(config) {
  // 1. Copier le fichier Kotlin dans android/app/src/main/java/…
  config = withDangerousMod(config, [
    'android',
    async (c) => {
      const destDir = path.join(
        c.modRequest.projectRoot,
        'android', 'app', 'src', 'main', 'java',
        'com', 'lassiapp', 'lassiapp',
      );
      fs.mkdirSync(destDir, { recursive: true });
      fs.writeFileSync(path.join(destDir, 'CustomFirebaseMessagingService.kt'), KOTLIN, 'utf8');
      return c;
    },
  ]);

  // 2. Mettre à jour AndroidManifest :
  //    - Retirer io.invertase.firebase.messaging.ReactNativeFirebaseMessagingService
  //    - Ajouter .CustomFirebaseMessagingService (qui l'étend)
  config = withAndroidManifest(config, (c) => {
    const manifest = c.modResults.manifest;
    const app = manifest.application?.[0];
    if (!app) return c;

    if (!manifest.$['xmlns:tools']) {
      manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    }

    if (!Array.isArray(app.service)) app.service = [];

    // Retirer l'inscription RNFirebase originale pour éviter la double réception
    app.service = app.service.filter(
      (s) => s.$?.['android:name'] !== 'io.invertase.firebase.messaging.ReactNativeFirebaseMessagingService',
    );

    // Ajouter notre service personnalisé
    const alreadyPresent = app.service.some(
      (s) => s.$?.['android:name'] === '.CustomFirebaseMessagingService',
    );
    if (!alreadyPresent) {
      app.service.push({
        $: {
          'android:name': '.CustomFirebaseMessagingService',
          'android:exported': 'false',
        },
        'intent-filter': [
          {
            action: [{ $: { 'android:name': 'com.google.firebase.MESSAGING_EVENT' } }],
          },
        ],
      });
    }

    return c;
  });

  return config;
};
