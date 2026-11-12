// ─── Polyfills (chargés avant tout, Hermes ne fournit pas ces APIs web) ───────
import './src/polyfills';

import { Platform } from 'react-native';
import { registerRootComponent } from 'expo';
import Constants from 'expo-constants';
// App chargé en lazy require (après le BGHandler) pour éviter la race condition :
// Firebase appelle AppRegistry.runHeadlessTask ~1s après le démarrage du process.
// Si App est importé statiquement, tous ses modules (expo-av etc.) sont résolus
// d'abord, et messaging().setBackgroundMessageHandler() n'est appelé qu'après →
// le headless task n'est pas encore enregistré quand Firebase le cherche.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const App = (require('./App') as { default: Parameters<typeof registerRootComponent>[0] }).default;

// ─── Firebase background message handler (Android + iOS) ─────────────────────
// Android : expo-notifications (ExpoFcmMessagingService) AFFICHE DÉJÀ la notif
// background via le canal commandes-v2/messages-v2 (son inclus). Le handler ne
// doit donc PLUS créer de 2e notif — sinon DOUBLON system-tray sur toutes les
// notifs (crons inclus). On garde le handler (Firebase l'exige en background) +
// l'annonce vocale commandes, mais AUCUN scheduleNotificationAsync.
// iOS : APNs affiche nativement (aps.alert), mais Firebase doit avoir un handler
// enregistré sinon il supprime les messages data-only en background.
if (Platform.OS !== 'web') try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const _fbMsg = require('@react-native-firebase/messaging');
  const messaging = (_fbMsg.default ?? _fbMsg) as { (): { setBackgroundMessageHandler: (h: (m: any) => Promise<void>) => void } };

  if (Platform.OS === 'android') {
    messaging().setBackgroundMessageHandler(async (msg: Record<string, any>) => {
      try {
        const title = (msg.notification?.title ?? msg.data?.title ?? 'LASSI') as string;
        let notifData: Record<string, unknown> = {};
        try { notifData = JSON.parse((msg.data?.body as string) ?? '{}'); } catch { /* ignore */ }

        const isOrderNotif =
          notifData.type === 'new_order' ||
          notifData.type === 'commande'  ||
          (title ?? '').toLowerCase().includes('commande');

        // Annonce vocale Android arrière-plan (TextToSpeech = service système, fonctionne en headless)
        if (isOrderNotif) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const Speech = require('expo-speech') as typeof import('expo-speech');
            const opts = { language: 'fr-FR', rate: 0.85, pitch: 1.1, volume: 1 };
            Speech.stop();
            Speech.speak('Nouvelle commande reçue', opts);
            // Répétition après 2.5s — plus difficile à rater
            setTimeout(() => { try { Speech.speak('Nouvelle commande reçue', opts); } catch { /* ignore */ } }, 2500);
          } catch { /* best-effort */ }
        }
        // PAS de scheduleNotificationAsync : expo-notifications affiche déjà la notif.
      } catch (e) {
        console.error('[LASSI-BGHandler] handler failed:', e);
      }
    });
  } else {
    // iOS : handler minimal — APNs gère l'affichage nativement via aps.alert.
    // Sans ce handler, Firebase supprime les messages data-only reçus en background.
    messaging().setBackgroundMessageHandler(async (_msg: Record<string, any>) => {});
  }
} catch (e) {
  console.error('[LASSI-BGHandler] FAILED to register:', e);
}

// Manifest sans restriction (Google Play large screen), portrait verrouillé ici.
// require() dans try/catch pour compatibilité OTA si le module natif est absent du build courant.
if (Platform.OS !== 'web') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const SO = require('expo-screen-orientation');
    SO.lockAsync(SO.OrientationLock.PORTRAIT).catch(() => {});
  } catch (_) {}
}

const IS_EXPO_GO = Constants.executionEnvironment === 'storeClient';

function reportToCrashlytics(error: Error): void {
  if (IS_EXPO_GO || Platform.OS === 'web' || __DEV__) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const crashlytics = require('@react-native-firebase/crashlytics').default;
    crashlytics().recordError(error);
  } catch (_) {}
}

// Capture les erreurs JS non gérées en mode release (évite le crash silencieux Android)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _ErrorUtils = (global as any).ErrorUtils;
if (_ErrorUtils) {
  const defaultHandler = _ErrorUtils.getGlobalHandler();
  _ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
    if (__DEV__) {
      defaultHandler(error, isFatal);
    } else {
      console.error('[GlobalError]', isFatal ? 'FATAL' : 'non-fatal', error?.message ?? String(error));
      reportToCrashlytics(error);
      if (!isFatal) defaultHandler(error, isFatal);
    }
  });
}

registerRootComponent(App);
