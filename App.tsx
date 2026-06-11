import React, { useState, useCallback, useEffect } from 'react';
import { View, StyleSheet, Platform, AppState } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as ExpoSplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import Constants from 'expo-constants';
import {
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { Poppins_300Light } from '@expo-google-fonts/poppins';

import { colors }        from './src/theme';
import SplashScreen      from './src/screens/SplashScreen';
import OnboardingScreen  from './src/screens/OnboardingScreen';
import AuthNavigator     from './src/screens/AuthNavigator';
import HomeNavigator     from './src/screens/home/HomeNavigator';
import MerchantNavigator from './src/screens/merchant/MerchantNavigator';
import ErrorBoundary     from './src/components/common/ErrorBoundary';
import OfflineBanner     from './src/components/common/OfflineBanner';
import { useConnectionWatcher } from './src/hooks/useConnectionWatcher';
import useAuthStore            from './src/store/authStore';
import useShopStore             from './src/store/shopStore';
import useOrdersStore           from './src/store/ordersStore';
import useDebtsStore            from './src/store/debtsStore';
import useFavoritesStore        from './src/store/favoritesStore';
import useNotificationsStore    from './src/store/notificationsStore';
import useCartStore             from './src/store/cartStore';
import * as authService         from './src/services/auth';
import { usePushToken, removeCurrentDeviceToken } from './src/hooks/usePushToken';
import { usePaymentDeepLink } from './src/hooks/usePaymentDeepLink';
import usePendingNavStore from './src/store/pendingNavStore';
import {
  markAppBackgrounded,
  clearBackgroundMark,
  hasInactivityTimeoutElapsed,
} from './src/lib/sessionTimeout';

// ─── Détection Expo Go ────────────────────────────────────────────────────────
// SDK 53+ : les push notifications Android ne fonctionnent plus dans Expo Go.
// Le simple import de 'expo-notifications' déclenche TokenAutoRegistration
// au chargement du module → erreur console. On utilise require() LAZY pour
// que le module ne se charge jamais dans Expo Go.
const IS_EXPO_GO = Constants.executionEnvironment === 'storeClient';

// Chargement paresseux : le module expo-notifications n'est jamais évalué
// dans Expo Go, ce qui empêche TokenAutoRegistration de tourner.
type N = typeof import('expo-notifications');
const getN = (): N | null => {
  if (IS_EXPO_GO) return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('expo-notifications') as N;
};

ExpoSplashScreen.preventAutoHideAsync();

type Screen = 'splash' | 'onboarding' | 'auth' | 'client' | 'merchant';

// Décode les données d'une notification push et stocke la navigation en attente
function handleNotifData(data: Record<string, any> | undefined | null) {
  if (!data) return;
  const setPendingNav = usePendingNavStore.getState().setPendingNav;
  if (data.type === 'message' && data.conversationId) {
    setPendingNav({ type: 'msg', conversationId: data.conversationId });
  } else if (data.type === 'commande' && data.orderId) {
    setPendingNav({ type: 'order', orderId: data.orderId });
  }
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('splash');

  // Enregistre le token push dès que l'utilisateur est connecté
  usePushToken();
  // Écoute les retours Wave/OM via deep link
  usePaymentDeepLink();
  // Section 10 : surveille la joignabilité de Supabase (bandeau hors-ligne)
  useConnectionWatcher();

  const [fontsLoaded] = useFonts({
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
    Poppins_300Light,
  });

  const onLayout = useCallback(async () => {
    if (fontsLoaded) await ExpoSplashScreen.hideAsync();
  }, [fontsLoaded]);

  // Déconnexion : supprime le token push, Supabase + tous les stores + retour à l'auth
  const handleLogout = useCallback(async () => {
    await removeCurrentDeviceToken();
    try { await authService.logout(); } catch (_) {}
    useAuthStore.getState().logout();
    useShopStore.setState({
      shopId: null,
      profile:  { initial: 'M', name: 'Ma Boutique', subtitle: '', isOpen: true },
      context:  { shopType: 'products', openingHours: null, isManuallyClose: false, galleryUrls: [], subcategories: [] },
      categories: [],
      products:   [],
      loading:    false,
      shopNotFound: false,
    });
    useOrdersStore.setState({ orders: [], shopId: null, loading: false });
    useDebtsStore.setState({ debtors: [], shopId: null, loading: false });
    useFavoritesStore.setState({ favorites: [], loading: false });
    useNotificationsStore.setState({ notifications: [], loading: false });
    useCartStore.getState().clearCart();
    setScreen('auth');
  }, []);

  // Handler de premier plan + canaux Android
  // Le require() ici est lazy : expo-notifications ne charge QUE si !IS_EXPO_GO
  useEffect(() => {
    const N = getN();
    if (!N) return;

    // Affiche les notifications quand l'app est au premier plan
    N.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert:  true,
        shouldPlaySound:  true,
        shouldSetBadge:   false,
        shouldShowBanner: true,
        shouldShowList:   true,
      }),
    });

    // Canaux Android
    if (Platform.OS === 'android') {
      N.setNotificationChannelAsync('commandes', {
        name:             'Commandes',
        importance:       N.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor:       '#FDCF34',
        sound:            'default',
      });
      N.setNotificationChannelAsync('messages', {
        name:       'Messages',
        importance: N.AndroidImportance.DEFAULT,
        sound:      'default',
      });
    }
  }, []);

  // Écoute les taps sur notification (non disponible dans Expo Go SDK 53+)
  useEffect(() => {
    const N = getN();
    if (!N) return;

    const sub = N.addNotificationResponseReceivedListener((response) => {
      handleNotifData(response.notification.request.content.data as Record<string, any>);
    });

    // Cold start : l'app a été ouverte depuis un tap sur une notif
    N.getLastNotificationResponseAsync().then((response) => {
      if (response?.notification) {
        handleNotifData(response.notification.request.content.data as Record<string, any>);
      }
    });

    return () => sub.remove();
  }, []);

  // Écoute les changements Supabase (expiration de token, déconnexion externe…)
  useEffect(() => {
    const unsubscribe = authService.onAuthStateChange((user) => {
      useAuthStore.getState().setUser(user);
      if (!user && screen !== 'splash' && screen !== 'onboarding' && screen !== 'auth') {
        setScreen('auth');
      }
    });
    return unsubscribe;
  }, [screen]);

  // Déconnexion automatique après inactivité prolongée (Section 7) :
  // on note l'heure de mise en arrière-plan, et au retour au premier plan
  // on déconnecte si le délai INACTIVITY_TIMEOUT_MS est dépassé.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        (async () => {
          const expired = await hasInactivityTimeoutElapsed();
          await clearBackgroundMark();
          if (expired && useAuthStore.getState().isAuthenticated) {
            await handleLogout();
          }
        })();
      } else if (nextState === 'background' || nextState === 'inactive') {
        markAppBackgrounded();
      }
    });
    return () => sub.remove();
  }, [handleLogout]);

  if (!fontsLoaded) return null;

  return (
    <View style={styles.root} onLayout={onLayout}>
      <StatusBar style="light" />
      <OfflineBanner />

      <ErrorBoundary>
      {screen === 'splash' && (
        <SplashScreen onFinish={async () => {
          const { hasSeenOnboarding } = useAuthStore.getState();

          // Section 7 : redémarrage à froid après une mise en arrière-plan
          // trop longue → on déconnecte au lieu de restaurer la session.
          const expired = await hasInactivityTimeoutElapsed();
          await clearBackgroundMark();
          if (expired) {
            await authService.logout().catch(() => {});
            useAuthStore.getState().setLoading(false);
            setScreen(hasSeenOnboarding ? 'auth' : 'onboarding');
            return;
          }

          const sessionUser = await authService.getSessionUser();

          if (sessionUser) {
            useAuthStore.getState().setUser(sessionUser);
            setScreen(sessionUser.role === 'merchant' ? 'merchant' : 'client');
            return;
          }

          useAuthStore.getState().setLoading(false);
          setScreen(hasSeenOnboarding ? 'auth' : 'onboarding');
        }} />
      )}

      {screen === 'onboarding' && (
        <OnboardingScreen onFinish={() => {
          useAuthStore.getState().setOnboardingSeen();
          setScreen('auth');
        }} />
      )}

      {screen === 'auth' && (
        <AuthNavigator onComplete={(role) =>
          setScreen(role === 'merchant' ? 'merchant' : 'client')
        } />
      )}

      {screen === 'client'   && <HomeNavigator     onLogout={handleLogout} />}
      {screen === 'merchant' && <MerchantNavigator onLogout={handleLogout} />}
      </ErrorBoundary>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
});
