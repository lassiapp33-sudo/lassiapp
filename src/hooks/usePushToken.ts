import { useEffect } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import useAuthStore from '../store/authStore';
import useGerantStore from '../store/gerantStore';
import { savePushToken, deletePushToken } from '../services/notifications';

const EAS_PROJECT_ID = 'e9058ef3-df10-43e4-af04-6830a98025e9';
const PUSH_LOG_URL = 'https://tsdemraszwtbzgtyjzum.supabase.co/functions/v1/push-log';

const IS_EXPO_GO = Constants.executionEnvironment === 'storeClient';

type N = typeof import('expo-notifications');
const getN = (): N | null => {
  if (IS_EXPO_GO || Platform.OS === 'web') return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('expo-notifications') as N;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getFirebaseMessaging = (): any | null => {
  if (IS_EXPO_GO || Platform.OS === 'web') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('@react-native-firebase/messaging').default;
  } catch {
    return null;
  }
};

async function logPush(userId: string | undefined, platform: string, status: string, extra?: { token_prefix?: string; error?: string }) {
  fetch(PUSH_LOG_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, platform, status, ...extra }),
  }).catch(() => {});
}

let currentDeviceToken: string | null = null;
// Garde l'unsubscribe onTokenRefresh pour éviter les doublons au remontage du hook
let _tokenRefreshUnsub: (() => void) | null = null;

export function getCurrentDeviceToken(): string | null {
  return currentDeviceToken;
}

// Sauvegarde le token APNs (brut) → ExponentPushToken via Expo Push Service
// IMPORTANT : iOS exige type:'apns' (token APNs brut), jamais type:'fcm'
// Un FCM token passé avec type:'fcm' sur iOS = Expo ne peut pas router via APNs → zéro lock screen
async function apnsToExpoAndSave(apnsToken: string, userId: string | undefined): Promise<void> {
  const N = getN();
  if (!N) return;
  try {
    await logPush(userId, 'ios', 'apns_token_ok', { token_prefix: apnsToken.slice(0, 20) });
    const tokenData = await N.getExpoPushTokenAsync({
      projectId: EAS_PROJECT_ID,
      devicePushToken: { type: 'apns', data: apnsToken },
    });
    const expoToken = tokenData?.data ?? null;
    if (!expoToken) {
      await logPush(userId, 'ios', 'expo_token_error', { token_prefix: 'null_after_apns' });
      return;
    }
    if (currentDeviceToken === expoToken) return;
    currentDeviceToken = expoToken;
    await savePushToken(expoToken, 'ios');
    await logPush(userId, 'ios', 'token_saved', { token_prefix: expoToken.slice(0, 35) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await logPush(userId, 'ios', 'expo_token_error', { error: msg.slice(0, 200) });
  }
}

export function usePushToken() {
  const userId = useAuthStore(s => s.user?.id);
  const gerantActive = useGerantStore(s => s.isActive);

  useEffect(() => {
    const N = getN();
    if ((!userId && !gerantActive) || !N) return;

    const os = Platform.OS === 'ios' ? 'ios' : 'android';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nativeBuild = (Constants as any).nativeBuildVersion ?? '?';
    const osVersion = `${Platform.OS} ${Platform.Version} build=${nativeBuild}`;

    (async () => {
      try {
        await logPush(userId, os, 'hook_started', { error: osVersion });

        const { status: existing } = await N.getPermissionsAsync();
        let finalStatus = existing;
        if (existing !== 'granted') {
          const { status } = await N.requestPermissionsAsync();
          finalStatus = status;
        }
        if (finalStatus !== 'granted') {
          await logPush(userId, os, 'permission_denied', { error: finalStatus });
          return;
        }
        await logPush(userId, os, 'permission_granted');

        if (Platform.OS === 'ios') {
          // useFrameworks:static casse le subscriber APNs natif d'expo-notifications.
          // Route FCM via swizzling Firebase (seul mécanisme fonctionnel).
          await logPush(userId, os, 'device_token_attempt');

          const messaging = getFirebaseMessaging();
          if (!messaging) {
            await logPush(userId, os, 'device_token_error', { token_prefix: 'no_fcm_module' });
            return;
          }

          try {
            await messaging().registerDeviceForRemoteMessages();
          } catch (e) {
            await logPush(userId, os, 'fcm_register_error', { error: (e instanceof Error ? e.message : String(e)).slice(0, 200) });
          }

          // ─── onTokenRefresh : listener persistant qui survit aux remontages du hook ──
          // FIX ROOT CAUSE : la boucle poll s'arrêtait quand l'user naviguait (alive=false)
          // avant qu'APNs réponde. onTokenRefresh est appelé même après démontage du hook.
          // onTokenRefresh : re-register si APNs renouvelle le token
          // On récupère le token APNs brut via getAPNSToken() après chaque refresh FCM
          if (!_tokenRefreshUnsub) {
            _tokenRefreshUnsub = messaging().onTokenRefresh(async (_fcmToken: string) => {
              try {
                const apns = await messaging().getAPNSToken();
                if (apns) await apnsToExpoAndSave(apns, userId);
              } catch { /* best-effort */ }
            });
          }

          // Tentative immédiate : APNs token déjà disponible (app ouverte une 2e fois)
          let apnsToken: string | null = null;
          for (let i = 0; i < 10; i++) {
            try {
              const apns = await messaging().getAPNSToken();
              if (apns) { apnsToken = apns; break; }
            } catch { /* APNs pas encore prêt */ }
            await new Promise<void>(r => setTimeout(r, 1000));
          }

          if (apnsToken) {
            await apnsToExpoAndSave(apnsToken, userId);
          } else {
            // Pas de token immédiat → onTokenRefresh prendra le relais dès qu'APNs répond
            await logPush(userId, os, 'waiting_token_refresh', { error: 'onTokenRefresh registered' });
          }

        } else {
          // Android
          await logPush(userId, os, 'device_token_attempt');
          const dt = await N.getDevicePushTokenAsync();
          if (!dt?.data) {
            await logPush(userId, os, 'device_token_error', { token_prefix: 'dt_null' });
            return;
          }
          await logPush(userId, os, 'device_token_ok', { token_prefix: dt.data.slice(0, 20) });
          const tokenData = await N.getExpoPushTokenAsync({ projectId: EAS_PROJECT_ID });
          const expoToken = tokenData?.data ?? null;
          if (!expoToken) return;
          currentDeviceToken = expoToken;
          await savePushToken(expoToken, os);
          await logPush(userId, os, 'token_saved', { token_prefix: expoToken.slice(0, 35) });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await logPush(userId, os, 'fatal_error', { error: msg.slice(0, 200) });
      }
    })();
  }, [userId, gerantActive]);
}

export async function removeCurrentDeviceToken(): Promise<void> {
  const token = currentDeviceToken;
  if (!token) return;
  currentDeviceToken = null;
  _tokenRefreshUnsub?.();
  _tokenRefreshUnsub = null;
  await deletePushToken(token).catch(() => {});
}
