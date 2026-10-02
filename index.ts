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

// ─── Firebase background message handler (Android uniquement) ────────────────
// iOS : le son est géré nativement par APNs — pas besoin de ce handler.
// Android : Firebase affiche les notifs background sans son → le handler
// crée une 2e notif via expo-notifications avec PRIORITY_MAX + son explicite.
// Note : un doublon persiste (FCM-Notification silencieuse + notre notif sonore)
// → éliminable seulement via rebuild natif (FirebaseMessagingService override).
if (Platform.OS === 'android') try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const _fbMsg = require('@react-native-firebase/messaging');
  const messaging = (_fbMsg.default ?? _fbMsg) as { (): { setBackgroundMessageHandler: (h: (m: any) => Promise<void>) => void } };
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Notifications = require('expo-notifications');

  messaging().setBackgroundMessageHandler(async (msg: Record<string, any>) => {
    try {
      // Expo Push → FCM data mapping:
      //   msg.data.title   = notification title
      //   msg.data.message = notification body (NOT msg.data.body)
      //   msg.data.body    = stringified JSON of the Expo 'data' payload
      const title = (msg.notification?.title ?? msg.data?.title ?? 'LASSI') as string;
      const body  = (msg.notification?.body  ?? msg.data?.message ?? '') as string;
      let notifData: Record<string, unknown> = {};
      try { notifData = JSON.parse((msg.data?.body as string) ?? '{}'); } catch { /* ignore */ }

      // Annuler la notification silencieuse Firebase AVANT d'afficher la nôtre
      // (évite le doublon : Firebase crée FCM-Notification sans son, on crée la
      // vraie avec son via scheduleNotificationAsync)
      try {
        const { NativeModules } = require('react-native');
        NativeModules.ExpoNotificationsModule?.dismissAll?.();
      } catch { /* best-effort */ }

      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          sound:    'default',
          data:     notifData,
          priority: Notifications.AndroidNotificationPriority?.MAX ?? 2,
          vibrate:  [0, 250, 250, 250],
        },
        trigger: null,
      });
    } catch (e) {
      console.error('[LASSI-BGHandler] scheduleNotification failed:', e);
    }
  });
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
