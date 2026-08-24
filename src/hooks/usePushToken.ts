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

// Expo Go SDK 53+ : le simple import de expo-notifications déclenche
// TokenAutoRegistration → erreur console. require() lazy évite ça.
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
    (async () => {
      try {
        await logPush(userId, os, 'hook_started');
        const { status: existing } = await N.getPermissionsAsync();
        let finalStatus = existing;
        if (existing !== 'granted') {
          const { status } = await N.requestPermissionsAsync();
          finalStatus = status;
        }
        if (finalStatus !== 'granted') {
          console.warn('[push] Permission refusée — statut:', finalStatus);
          await logPush(userId, os, 'permission_denied', { error: finalStatus });
          return;
        }

        await logPush(userId, os, 'permission_granted');

        // Étape 1 : token APNs brut — retry 3× (réseau APNs peut être lent)
        let deviceToken: string | null = null;
        const MAX_ATTEMPTS = 3;
        let lastDtErr = '';
        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
          try {
            await logPush(userId, os, 'device_token_attempt', { error: `attempt_${attempt}` });
            const dt = await Promise.race([
              N.getDevicePushTokenAsync(),
              new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`getDevicePushTokenAsync timeout 30s (attempt ${attempt})`)), 30000)),
            ]) as { data: string };
            deviceToken = dt?.data ?? null;
            await logPush(userId, os, 'device_token_ok', { token_prefix: deviceToken?.slice(0, 20) ?? 'null' });
            break;
          } catch (dtErr) {
            lastDtErr = dtErr instanceof Error ? dtErr.message : String(dtErr);
            await logPush(userId, os, 'device_token_error', { error: lastDtErr });
            if (attempt < MAX_ATTEMPTS) {
              await new Promise<void>(r => setTimeout(r, 5000));
            }
          }
        }
        if (!deviceToken) return;

        // Étape 2 : Expo push token
        const tokenData = await Promise.race([
          N.getExpoPushTokenAsync({ projectId: EAS_PROJECT_ID }),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('getExpoPushTokenAsync timeout 15s')), 15000)),
        ]).catch(async (e: unknown) => {
          const msg = e instanceof Error ? e.message : String(e);
          await logPush(userId, os, 'expo_token_error', { error: msg });
          return null;
        }) as { data: string } | null;

        const token = tokenData?.data;
        if (!token) {
          console.warn('[push] getExpoPushTokenAsync a retourné null');
          await logPush(userId, os, 'token_null');
          return;
        }

        console.log('[push] Token enregistré:', token.slice(0, 30) + '...');
        currentDeviceToken = token;
        await savePushToken(token, os);
        await logPush(userId, os, 'token_saved', { token_prefix: token.slice(0, 35) });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[push] Échec enregistrement token:', msg);
        await logPush(userId, os, 'error', { error: msg });
      }
    })().catch((err) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[push] Erreur inattendue:', msg);
      logPush(userId, os, 'fatal_error', { error: msg });
    });
  }, [userId, gerantActive]);
}

export async function removeCurrentDeviceToken(): Promise<void> {
  const token = currentDeviceToken;
  if (!token) return;
  currentDeviceToken = null;
  await deletePushToken(token).catch(() => {});
}
