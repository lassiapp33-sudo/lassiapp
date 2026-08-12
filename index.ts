// ─── Polyfills (chargés avant tout, Hermes ne fournit pas ces APIs web) ───────
import './src/polyfills';

import { Platform } from 'react-native';
import { registerRootComponent } from 'expo';
import Constants from 'expo-constants';
import App from './App';

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
