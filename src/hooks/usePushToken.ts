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

export function getCurrentDeviceToken(): string | null {
  return currentDeviceToken;
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
    let alive = true;
    let tokenSaved = false;

    (async () => {
      try {
        await logPush(userId, os, 'hook_started', { error: osVersion });

        const { status: existing } = await N.getPermissionsAsync();
        let finalStatus = existing;
        if (existing !== 'granted') {
          const { status } = await N.requestPermissionsAsync();
          finalStatus = status;
        }
        if (finalStatus !== 'granted' || !alive) {
          await logPush(userId, os, 'permission_denied', { error: finalStatus });
          return;
        }
        await logPush(userId, os, 'permission_granted');

        let expoToken: string | null = null;

        if (Platform.OS === 'ios') {
          // useFrameworks:static casse le subscriber APNs natif d'expo-notifications
          // (ni didRegister ni didFail → hang). Le SEUL mécanisme qui capte l'APNs token
          // est le swizzling Firebase (proxy actif). On passe donc par la route FCM.
          // La course "No APNS token specified" est évitée en attendant l'APNs token
          // (getAPNSToken) AVANT d'appeler getToken.
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

          // L'APNs token arrive en async via le swizzling Firebase. On l'attend avant getToken.
          let fcmToken: string | null = null;
          let apnsSeen = false;
          for (let i = 0; i < 40 && !fcmToken && alive; i++) {
            try {
              const apns = await messaging().getAPNSToken();
              if (apns && !apnsSeen) {
                apnsSeen = true;
                await logPush(userId, os, 'apns_token_ok', { token_prefix: String(apns).slice(0, 20) });
              }
              if (apns) {
                const t = await messaging().getToken();
                if (t) fcmToken = t;
              }
            } catch {
              // APNs pas encore prêt → réessaie
            }
            if (!fcmToken) await new Promise<void>(r => setTimeout(r, 1000));
          }

          if (!alive) return;
          if (!fcmToken) {
            await logPush(userId, os, 'device_token_error', { token_prefix: 'no_fcm_40s', error: apnsSeen ? 'apns_ok_but_no_fcm' : 'apns_never_arrived' });
            return;
          }
          await logPush(userId, os, 'fcm_token_ok', { token_prefix: fcmToken.slice(0, 20) });

          const tokenData = await N.getExpoPushTokenAsync({
            projectId: EAS_PROJECT_ID,
            devicePushToken: { type: 'fcm', data: fcmToken },
          });
          expoToken = tokenData?.data ?? null;
          await logPush(userId, os, 'expo_token_via_fcm', { token_prefix: expoToken?.slice(0, 35) });
        } else {
          await logPush(userId, os, 'device_token_attempt');
          const dt = await N.getDevicePushTokenAsync();
          if (!alive || !dt?.data) {
            await logPush(userId, os, 'device_token_error', { token_prefix: 'dt_null' });
            return;
          }
          await logPush(userId, os, 'device_token_ok', { token_prefix: dt.data.slice(0, 20) });
          const tokenData = await N.getExpoPushTokenAsync({ projectId: EAS_PROJECT_ID });
          expoToken = tokenData?.data ?? null;
        }

        if (!expoToken || !alive || tokenSaved) return;
        tokenSaved = true;
        currentDeviceToken = expoToken;
        await savePushToken(expoToken, os);
        await logPush(userId, os, 'token_saved', { token_prefix: expoToken.slice(0, 35) });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await logPush(userId, os, 'fatal_error', { error: msg });
      }
    })();

    return () => { alive = false; };
  }, [userId, gerantActive]);
}

export async function removeCurrentDeviceToken(): Promise<void> {
  const token = currentDeviceToken;
  if (!token) return;
  currentDeviceToken = null;
  await deletePushToken(token).catch(() => {});
}
