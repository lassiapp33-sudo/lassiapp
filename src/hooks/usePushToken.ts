import { useEffect } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import useAuthStore from '../store/authStore';
import { savePushToken, deletePushToken } from '../services/notifications';

const EAS_PROJECT_ID = 'e9058ef3-df10-43e4-af04-6830a98025e9';

// Expo Go SDK 53+ : le simple import de expo-notifications déclenche
// TokenAutoRegistration → erreur console. require() lazy évite ça.
const IS_EXPO_GO = Constants.executionEnvironment === 'storeClient';

type N = typeof import('expo-notifications');
const getN = (): N | null => {
  if (IS_EXPO_GO) return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('expo-notifications') as N;
};

let currentDeviceToken: string | null = null;

export function getCurrentDeviceToken(): string | null {
  return currentDeviceToken;
}

export function usePushToken() {
  const userId = useAuthStore(s => s.user?.id);

  useEffect(() => {
    const N = getN();
    if (!userId || !N) return;

    (async () => {
      try {
        const { status: existing } = await N.getPermissionsAsync();
        let finalStatus = existing;
        if (existing !== 'granted') {
          const { status } = await N.requestPermissionsAsync();
          finalStatus = status;
        }
        if (finalStatus !== 'granted') return;

        const tokenData = await N.getExpoPushTokenAsync({ projectId: EAS_PROJECT_ID });
        const token = tokenData?.data;
        if (!token) return;

        currentDeviceToken = token;
        await savePushToken(token, Platform.OS === 'ios' ? 'ios' : 'android');
      } catch {
        // Silencieux — push token est best-effort, non bloquant
      }
    })().catch(() => {});
  }, [userId]);
}

export async function removeCurrentDeviceToken(): Promise<void> {
  const token = currentDeviceToken;
  if (!token) return;
  currentDeviceToken = null;
  await deletePushToken(token).catch(() => {});
}
