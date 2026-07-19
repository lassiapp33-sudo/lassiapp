// ─── Polyfills (chargés avant tout, Hermes ne fournit pas ces APIs web) ───────
import './src/polyfills';

import { registerRootComponent } from 'expo';
import App from './App';

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
      if (!isFatal) defaultHandler(error, isFatal);
    }
  });
}

registerRootComponent(App);
