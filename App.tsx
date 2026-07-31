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
import { Cinzel_400Regular, Cinzel_500Medium, Cinzel_600SemiBold } from '@expo-google-fonts/cinzel';
import { Marcellus_400Regular } from '@expo-google-fonts/marcellus';
import { EBGaramond_400Regular, EBGaramond_400Regular_Italic, EBGaramond_500Medium } from '@expo-google-fonts/eb-garamond';
import { Lora_400Regular, Lora_400Regular_Italic, Lora_500Medium } from '@expo-google-fonts/lora';
import { Inter_300Light, Inter_400Regular } from '@expo-google-fonts/inter';

import { colors }        from './src/theme';
import SplashScreen         from './src/screens/SplashScreen';
import OnboardingScreen     from './src/screens/OnboardingScreen';
import AuthNavigator        from './src/screens/AuthNavigator';
import ResetPasswordScreen  from './src/screens/auth/ResetPasswordScreen';
import HomeNavigator     from './src/screens/home/HomeNavigator';
import MerchantNavigator from './src/screens/merchant/MerchantNavigator';
import LivreurNavigator  from './src/screens/livreur/LivreurNavigator';
import ErrorBoundary     from './src/components/common/ErrorBoundary';
import OfflineBanner     from './src/components/common/OfflineBanner';
import NotifCardModal    from './src/components/common/NotifCardModal';
import NotifPopupBanner  from './src/components/common/NotifPopupBanner';
import AnnonceModal             from './src/components/common/AnnonceModal';
import NouveauPrestataireBanner from './src/components/common/NouveauPrestataireBanner';
import { useAnnonces }          from './src/hooks/useAnnonces';
import { useConnectionWatcher } from './src/hooks/useConnectionWatcher';
import useAuthStore, { AuthUser } from './src/store/authStore';
import useShopStore             from './src/store/shopStore';
import useOrdersStore           from './src/store/ordersStore';
import useDebtsStore            from './src/store/debtsStore';
import useFavoritesStore        from './src/store/favoritesStore';
import useNotificationsStore from './src/store/notificationsStore';
import useNotifPopupStore       from './src/store/notifPopupStore';
import useCartStore             from './src/store/cartStore';
import AsyncStorage             from '@react-native-async-storage/async-storage';
import * as authService         from './src/services/auth';
import { SESSION_ACTIVE_KEY }   from './src/services/auth';
import { usePushToken, removeCurrentDeviceToken } from './src/hooks/usePushToken';
import { usePaymentDeepLink } from './src/hooks/usePaymentDeepLink';
import usePendingNavStore from './src/store/pendingNavStore';
import {
  markAppBackgrounded,
  clearBackgroundMark,
  hasInactivityTimeoutElapsed,
} from './src/lib/sessionTimeout';

// ─── Détection Expo Go / Web ──────────────────────────────────────────────────
// SDK 53+ : les push notifications Android ne fonctionnent plus dans Expo Go.
// Sur web, expo-notifications n'est pas disponible non plus.
// On utilise require() LAZY pour que le module ne se charge jamais dans ces cas.
const IS_EXPO_GO = Constants.executionEnvironment === 'storeClient';

type N = typeof import('expo-notifications');
const getN = (): N | null => {
  if (IS_EXPO_GO || Platform.OS === 'web') return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('expo-notifications') as N;
};

ExpoSplashScreen.preventAutoHideAsync();

type Screen = 'splash' | 'onboarding' | 'auth' | 'client' | 'merchant' | 'livreur' | 'resetPassword';

// Décode les données d'une notification push et stocke la navigation en attente
function handleNotifData(data: Record<string, any> | undefined | null) {
  if (!data) return;
  const setPendingNav = usePendingNavStore.getState().setPendingNav;
  if (data.type === 'message' && data.conversationId) {
    setPendingNav({ type: 'msg', conversationId: data.conversationId });
  } else if (data.type === 'commande' && data.orderId) {
    setPendingNav({ type: 'order', orderId: data.orderId });
  } else if (data.type === 'new_shop' && data.shop_id) {
    setPendingNav({ type: 'new_shop', shopId: data.shop_id as string, shopName: (data.shop_name as string) ?? '' });
  } else if (data.type === 'a_la_une_feed') {
    setPendingNav({ type: 'a_la_une_feed' });
  }
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('splash');
  const userId = useAuthStore(s => s.user?.id ?? null);
  const setPendingNav = usePendingNavStore(s => s.setPendingNav);

  // Promesse de session lancée au montage — en parallèle avec l'animation du splash (2,6s).
  // Résultat disponible dès onFinish, sans délai supplémentaire.
  const sessionFetch = React.useRef<Promise<AuthUser | null> | null>(null);

  // Charge les IDs de cartes déjà affichées (AsyncStorage) au démarrage
  const loadSeenIds = useNotifPopupStore(s => s.loadSeenIds);
  useEffect(() => { loadSeenIds(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Annonces admin non lues (table annonces, get_annonces_non_lues)
  const { annonceCourante, nbRestantes, marquerLue } = useAnnonces(userId);

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
    // Polices module VIP 5 Étoiles — chargées au démarrage avec le splash
    Cinzel_400Regular,
    Cinzel_500Medium,
    Cinzel_600SemiBold,
    Marcellus_400Regular,
    EBGaramond_400Regular,
    EBGaramond_400Regular_Italic,
    EBGaramond_500Medium,
    Lora_400Regular,
    Lora_400Regular_Italic,
    Lora_500Medium,
    Inter_300Light,
    Inter_400Regular,
  });

  // Cache le splash natif dès le premier rendu React.
  // Lance getSessionUser() SEULEMENT si une session existait (flag AsyncStorage sans Keystore).
  // Sans flag → pas de GoTrue au démarrage → mutex jamais bloqué → login instantané.
  useEffect(() => {
    ExpoSplashScreen.hideAsync().catch(() => {});
    AsyncStorage.getItem(SESSION_ACTIVE_KEY)
      .then(hasSession => {
        sessionFetch.current = hasSession
          ? authService.getSessionUser().catch(() => null)
          : Promise.resolve(null);
      })
      .catch(() => {
        sessionFetch.current = Promise.resolve(null);
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onLayout = useCallback(() => {}, []);

  // Déconnexion : supprime le token push, Supabase + tous les stores + retour à l'auth
  const handleLogout = useCallback(async () => {
    await removeCurrentDeviceToken();
    // Timeout 3s : scope:'global' peut bloquer indéfiniment sur Android prod (réseau lent)
    await Promise.race([
      authService.logout(),
      new Promise<void>(resolve => setTimeout(resolve, 3000)),
    ]).catch(() => {});
    useAuthStore.getState().logout();
    useShopStore.setState({
      shopId: null,
      profile:  { initial: 'M', name: 'Ma Boutique', subtitle: '', isOpen: true },
      context:  { shopType: 'products', openingHours: null, isManuallyClose: false, galleryUrls: [], subcategories: [], category: '' },
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
    try {
      const N = getN();
      if (!N) return;

      // Affiche les notifications quand l'app est au premier plan
      try {
        N.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert:  true,
            shouldPlaySound:  true,
            shouldSetBadge:   false,
            shouldShowBanner: true,
            shouldShowList:   true,
          }),
        });
      } catch (_) {}

      // Canaux Android — .catch() obligatoire : rejet non géré = crash prod
      if (Platform.OS === 'android') {
        N.setNotificationChannelAsync('commandes', {
          name:             'Commandes',
          importance:       N.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor:       '#FDCF34',
          sound:            'default',
        }).catch(() => {});
        N.setNotificationChannelAsync('messages', {
          name:       'Messages',
          importance: N.AndroidImportance.DEFAULT,
          sound:      'default',
        }).catch(() => {});
      }
    } catch (_) {}
  }, []);

  // Écoute les taps sur notification (non disponible dans Expo Go SDK 53+)
  useEffect(() => {
    try {
      const N = getN();
      if (!N) return;

      let sub: { remove: () => void } | null = null;
      try {
        sub = N.addNotificationResponseReceivedListener((response) => {
          handleNotifData(response.notification.request.content.data as Record<string, any>);
        });
      } catch (_) {}

      // Cold start : l'app a été ouverte depuis un tap sur une notif
      N.getLastNotificationResponseAsync()
        .then((response) => {
          if (response?.notification) {
            handleNotifData(response.notification.request.content.data as Record<string, any>);
          }
        })
        .catch(() => {});

      return () => { try { sub?.remove(); } catch (_) {} };
    } catch (_) {
      return undefined;
    }
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

  // Intercepte l'event PASSWORD_RECOVERY (lien email reset-password)
  useEffect(() => {
    return authService.onPasswordRecovery(() => setScreen('resetPassword'));
  }, []);

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


  return (
    <View style={styles.root} onLayout={onLayout}>
      <StatusBar style="light" />
      <OfflineBanner />

      {/* Bannière slide-top pour commandes et messages (auto-dismiss 5s) */}
      <NotifPopupBanner onView={() => setPendingNav({ type: 'notifications' })} />

      {/* Carte rich-notification pour récompenses, paiements, annonces-notif */}
      <NotifCardModal
        onView={() => setPendingNav({ type: 'notifications' })}
        onVoirAlaUne={() => setPendingNav({ type: 'a_la_une_feed' })}
      />

      {/* Annonces "Nouveau prestataire" → popup banner avec bouton Voir la vitrine */}
      {annonceCourante?.titre?.includes('Nouveau prestataire') && annonceCourante.tag ? (
        <NouveauPrestataireBanner
          annonce={annonceCourante}
          onDismiss={marquerLue}
          onVoirVitrine={() => {
            marquerLue();
            setPendingNav({ type: 'new_shop', shopId: annonceCourante.tag!, shopName: '' });
          }}
        />
      ) : (
        /* Autres annonces système admin (table annonces) — une seule fois par annonce */
        <AnnonceModal annonce={annonceCourante} nbRestantes={nbRestantes} onFermer={marquerLue} />
      )}

      <ErrorBoundary>
      {screen === 'splash' && (
        <SplashScreen onFinish={async () => {
          try {
            const { hasSeenOnboarding, user: cachedUser } = useAuthStore.getState();

            // Section 7 : redémarrage à froid après inactivité prolongée → déconnexion forcée
            const expired = await hasInactivityTimeoutElapsed();
            await clearBackgroundMark();
            if (expired) {
              await authService.logout().catch(() => {});
              useAuthStore.getState().setLoading(false);
              setScreen(hasSeenOnboarding ? 'auth' : 'onboarding');
              return;
            }

            // Utilise la promesse lancée au montage (en parallèle avec le splash).
            // Si elle n'existe pas (rare), on en lance une nouvelle avec un timeout court.
            // La session a déjà eu 2,6 s pour charger (pendant l'animation).
            // On attend au max 1 s de plus → sinon on utilise le cachedUser persisté.
            const sessionUser = await Promise.race([
              sessionFetch.current ?? authService.getSessionUser(),
              new Promise<null>((resolve) => setTimeout(() => resolve(null), 1000)),
            ]);

            if (sessionUser) {
              useAuthStore.getState().setUser(sessionUser);
              if (sessionUser.role === 'merchant') setScreen('merchant');
              else if (sessionUser.role === 'livreur') setScreen('livreur');
              else setScreen('client');
              return;
            }

            // Supabase n'a pas répondu à temps mais on a un utilisateur en cache :
            // ouvrir l'app immédiatement, la session sera re-vérifiée en arrière-plan.
            if (cachedUser) {
              useAuthStore.getState().setUser(cachedUser); // ← indispensable : passe isLoading à false
              if (cachedUser.role === 'merchant') setScreen('merchant');
              else if (cachedUser.role === 'livreur') setScreen('livreur');
              else setScreen('client');
              return;
            }

            useAuthStore.getState().setLoading(false);
            setScreen(hasSeenOnboarding ? 'auth' : 'onboarding');
          } catch {
            const { hasSeenOnboarding, user: cachedUser } = useAuthStore.getState();
            if (cachedUser) {
              useAuthStore.getState().setUser(cachedUser);
              if (cachedUser.role === 'merchant') setScreen('merchant');
              else if (cachedUser.role === 'livreur') setScreen('livreur');
              else setScreen('client');
              return;
            }
            useAuthStore.getState().setLoading(false);
            setScreen(hasSeenOnboarding ? 'auth' : 'onboarding');
          }
        }} />
      )}

      {screen === 'onboarding' && (
        <OnboardingScreen onFinish={() => {
          useAuthStore.getState().setOnboardingSeen();
          setScreen('auth');
        }} />
      )}

      {screen === 'auth' && (
        <AuthNavigator onComplete={(role) => {
          if (role === 'merchant') setScreen('merchant');
          else if (role === 'livreur') setScreen('livreur');
          else setScreen('client');
        }} />
      )}

      {screen === 'client'   && <HomeNavigator     onLogout={handleLogout} />}
      {screen === 'merchant' && <MerchantNavigator onLogout={handleLogout} />}
      {screen === 'livreur'  && <LivreurNavigator  onLogout={handleLogout} />}

      {screen === 'resetPassword' && (
        <ResetPasswordScreen onDone={() => setScreen('auth')} />
      )}
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
