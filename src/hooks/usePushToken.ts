import { useEffect } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import useAuthStore from '../store/authStore';
import useGerantStore from '../store/gerantStore';
import { savePushToken, deletePushToken } from '../services/notifications';

const EAS_PROJECT_ID = 'e9058ef3-df10-43e4-af04-6830a98025e9';
const PUSH_LOG_URL = 'https://tsdemraszwtbzgtyjzum.supabase.co/functions/v1/push-log';

async function logPush(userId: string | undefined, platform: string, status: string, extra?: { token_prefix?: string; error?: string }) {
  fetch(PUSH_LOG_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, platform, status, ...extra }),
  }).catch(() => {});
}

const IS_EXPO_GO = Constants.executionEnvironment === 'storeClient';

type N = typeof import('expo-notifications');
const getN = (): N | null => {
  if (IS_EXPO_GO || Platform.OS === 'web') return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('expo-notifications') as N;
};

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
    const osVersion = `${Platform.OS} ${Platform.Version}`;
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
          await logPush(userId, os, 'device_token_attempt');

          // Listener-based approach : capte le token dès qu'il arrive (event vs promise)
          const apnsToken = await new Promise<string | null>((resolve) => {
            let done = false;
            const timeout = setTimeout(() => {
              if (!done) { done = true; resolve(null); }
            }, 30000);

            const sub = N.addPushTokenListener((token) => {
              if (!done) {
                done = true;
                clearTimeout(timeout);
                sub.remove();
                resolve(token.data ?? null);
              }
            });

            // getDevicePushTokenAsync déclenche registerForRemoteNotifications
            N.getDevicePushTokenAsync()
              .then(dt => {
                if (!done && dt?.data) {
                  done = true;
                  clearTimeout(timeout);
                  sub.remove();
                  resolve(dt.data);
                }
              })
              .catch(() => {});
          });

          if (!alive) return;
          if (!apnsToken) {
            await logPush(userId, os, 'device_token_error', { token_prefix: 'apns_listener_30s' });
            return;
          }
          await logPush(userId, os, 'device_token_ok', { token_prefix: apnsToken.slice(0, 20) });
          const tokenData = await N.getExpoPushTokenAsync({
            projectId: EAS_PROJECT_ID,
            devicePushToken: { type: 'ios', data: apnsToken },
          });
          expoToken = tokenData?.data ?? null;
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
