import React, { useState, useCallback, useEffect } from 'react';
import { View, StyleSheet, Platform, Text, AppState } from 'react-native';
import * as Speech from 'expo-speech';


// Désactive la sélection sur tous les Text de l'app → supprime les soulignements
// bleus du correcteur Android et empêche la sélection accidentelle de texte.
(Text as unknown as { defaultProps: Record<string, unknown> }).defaultProps =
  Object.assign(
    (Text as unknown as { defaultProps?: Record<string, unknown> }).defaultProps ?? {},
    { selectable: false },
  );
import { StatusBar } from 'expo-status-bar';
import * as ExpoSplashScreen from 'expo-splash-screen';
import * as Updates from 'expo-updates';
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
import GerantNavigator   from './src/vip/GerantNavigator';
import useGerantStore    from './src/store/gerantStore';
import { getMonProfilVip } from './src/services/vip';
import ErrorBoundary     from './src/components/common/ErrorBoundary';
import OfflineBanner     from './src/components/common/OfflineBanner';
import NotifCardModal    from './src/components/common/NotifCardModal';
import NotifPopupBanner  from './src/components/common/NotifPopupBanner';
import AnnonceModal             from './src/components/common/AnnonceModal';
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
import { onSessionExpired, SUPABASE_MISCONFIGURED, supabase } from './src/lib/supabase';
import { usePushToken, removeCurrentDeviceToken } from './src/hooks/usePushToken';
import { usePaymentDeepLink } from './src/hooks/usePaymentDeepLink';
import usePendingNavStore from './src/store/pendingNavStore';
import { runImageRecovery } from './src/services/imageRecovery';

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

ExpoSplashScreen.setOptions({ duration: 0 });
ExpoSplashScreen.preventAutoHideAsync();

type Screen = 'splash' | 'onboarding' | 'auth' | 'guest' | 'client' | 'merchant' | 'livreur' | 'resetPassword';

// Décode les données d'une notification push et stocke la navigation en attente
function handleNotifData(data: Record<string, any> | undefined | null) {
  if (!data) return;
  const setPendingNav = usePendingNavStore.getState().setPendingNav;
  if (data.type === 'message' && data.conversationId) {
    setPendingNav({ type: 'msg', conversationId: data.conversationId });
  } else if (data.type === 'commande' && (data.orderId || data.pi_id)) {
    setPendingNav({ type: 'order', orderId: (data.orderId ?? data.pi_id) as string });
  } else if (data.type === 'table_reservation_nouvelle') {
    // Prestataire : nouvelle réservation de table → écran Réservations de table (pas Commandes)
    setPendingNav({ type: 'table_resa_prestataire' });
  } else if (
    data.type === 'reservation_acceptee' ||
    data.type === 'reservation_refusee' ||
    data.type === 'reservation_alternative'
  ) {
    // Client : réservation acceptée / refusée / alternative → Mes réservations de table
    setPendingNav({ type: 'table_resa_client' });
  } else if (data.type === 'visibility' && data.subscription_id) {
    // Prestataire : pack de visibilité activé → Ma Campagne (pas Commandes)
    setPendingNav({ type: 'visibility_campaign' });
  } else if (data.type === 'new_shop' && data.shop_id) {
    setPendingNav({ type: 'new_shop', shopId: data.shop_id as string, shopName: (data.shop_name as string) ?? '' });
  } else if (data.type === 'a_la_une_feed') {
    setPendingNav({ type: 'a_la_une_feed' });
  } else if (
    data.type === 'reservation_terrain' ||
    data.type === 'terrain_acces_valide'
  ) {
    // Prestataire → terrain_reservations (MerchantNavigator gère via terrainId)
    // Client      → terrain_my_reservations (HomeNavigator gère)
    setPendingNav({ type: 'terrain_resa', terrainId: data.terrainId as string | undefined });
  } else if (data.type === 'beauty_reservation' || data.type === 'beauty_acces_valide' || data.type === 'beauty_payment_confirme' || data.type === 'beauty_reservation_paye') {
    // Prestataire → beauty_reservations (à la bonne date) ; Client → Mes rendez-vous
    setPendingNav({ type: 'beauty_resa', date: data.dateResa as string | undefined });
  } else if (data.type === 'payout_done') {
    setPendingNav({ type: 'notifications' });
  }
}

// Guard: OTA bundle without env vars → placeholder Supabase URL → all requests fail
// but no native crash. Show a user-facing error screen instead.
function MisconfiguredScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: '#14152A', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      <Text style={{ color: '#FDCF34', fontSize: 20, fontWeight: 'bold', marginBottom: 12, textAlign: 'center' }}>
        Mise à jour corrompue
      </Text>
      <Text style={{ color: '#fff', fontSize: 15, textAlign: 'center', lineHeight: 22 }}>
        Une mise à jour incomplète a été téléchargée.{'\n'}
        Désinstalle et réinstalle LASSI depuis le Store pour retrouver l'accès.
      </Text>
    </View>
  );
}

function AppContent() {
  const [screen, setScreen] = useState<Screen>('splash');
  const userId       = useAuthStore(s => s.user?.id ?? null);
  const gerantActive = useGerantStore(s => s.isActive);
  const setGerant    = useGerantStore(s => s.setGerant);
  const clearGerant  = useGerantStore(s => s.clearGerant);
  const setPendingNav = usePendingNavStore(s => s.setPendingNav);

  // Vérifie si le marchand connecté est un gérant 5 Étoiles, puis navigue
  const goMerchant = React.useCallback(async () => {
    try {
      const profil = await getMonProfilVip();
      if (profil?.actif) setGerant(profil);
      else clearGerant();
    } catch { clearGerant(); }
    setScreen('merchant');
  }, [setGerant, clearGerant]);

  // Promesse de session lancée au montage — en parallèle avec l'animation du splash (2,6s).
  // Résultat disponible dès onFinish, sans délai supplémentaire.
  const sessionFetch = React.useRef<Promise<AuthUser | null> | null>(null);

  // OTA SDK 54 — useUpdates() réagit aux événements de la state machine native.
  // checkAutomatically: ON_LOAD fait check+download en arrière-plan ; quand
  // isUpdatePending passe à true (download terminé), on reload immédiatement.
  // Évite la race condition : checkForUpdateAsync() retournait false si le natif
  // avait déjà démarré son check, empêchant tout rechargement.
  const { isUpdateAvailable, isUpdatePending } =
    !__DEV__ && !IS_EXPO_GO && Platform.OS !== 'web'
      ? Updates.useUpdates()
      : { isUpdateAvailable: false, isUpdatePending: false };

  // Téléchargement automatique dès qu'un update est disponible
  useEffect(() => {
    if (!isUpdateAvailable) return;
    Updates.fetchUpdateAsync().catch(() => {});
  }, [isUpdateAvailable]); // eslint-disable-line react-hooks/exhaustive-deps

  // Rechargement dès que le téléchargement est terminé
  useEffect(() => {
    if (!isUpdatePending) return;
    Updates.reloadAsync().catch(() => {});
  }, [isUpdatePending]); // eslint-disable-line react-hooks/exhaustive-deps

  // Check manuel au retour en foreground (si app jamais fermée)
  useEffect(() => {
    if (__DEV__ || IS_EXPO_GO || Platform.OS === 'web') return;
    const sub = AppState.addEventListener('change', state => {
      if (state !== 'active') return;
      Updates.checkForUpdateAsync().catch(() => {});
      supabase.rpc('update_last_seen').catch(() => {});
    });
    return () => sub.remove();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Charge les IDs de cartes déjà affichées (AsyncStorage) au démarrage
  const loadSeenIds = useNotifPopupStore(s => s.loadSeenIds);
  useEffect(() => { loadSeenIds(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // RÉCUPÉRATION IMAGES PRODUITS — scanne le cache expo-image du téléphone et
  // ré-uploade les photos produits supprimées du bucket (bug cleanup-storage).
  // Différé 8s pour ne pas concurrencer l'OTA + le chargement initial.
  useEffect(() => {
    if (__DEV__ || IS_EXPO_GO || Platform.OS === 'web') return;
    const t = setTimeout(() => { runImageRecovery().catch(() => {}); }, 8000);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Cache le splash natif dès le premier rendu React (fond #14152A sans image statique).
  // Lance getSessionUser() SEULEMENT si une session existait (flag AsyncStorage sans Keystore).
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
    clearGerant();
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
      context:  { shopType: 'products', openingHours: null, isManuallyClose: false, galleryUrls: [], subcategories: [], category: '', paymentMethods: ['wave', 'om'], reservationEnabled: false },
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
  }, [clearGerant]);

  // SESSION GUARDIAN — NE JAMAIS DÉCONNECTER AUTOMATIQUEMENT.
  // onSessionExpired est gardé pour le logging uniquement.
  // Même si getValidToken() échoue après tous les fallbacks, l'utilisateur
  // reste dans l'app. Un JWT périmé cause des 401 sur les actions en cours,
  // ce qui est récupérable. Un handleLogout() automatique efface tout l'état
  // et est irrécupérable — c'est la pire chose qu'on puisse faire.
  useEffect(() => {
    return onSessionExpired(() => {
      // eslint-disable-next-line no-console
      console.warn('[LASSI] onSessionExpired — token introuvable, user garde son écran');
      // NE PAS appeler handleLogout() ici. Jamais.
    });
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
      // IMPORTANT : Android verrouille le son d'un canal à sa 1ère création.
      // Les anciens canaux 'commandes'/'messages' ont pu être créés muets sur
      // certains appareils → impossible de les réactiver. On crée des canaux
      // NEUFS (-v2) avec son garanti ; les Edge Functions ciblent ces ids.
      if (Platform.OS === 'android') {
        N.setNotificationChannelAsync('commandes-v2', {
          name:              'Commandes & paiements',
          importance:        N.AndroidImportance.MAX,
          vibrationPattern:  [0, 250, 250, 250],
          lightColor:        '#FDCF34',
          sound:             'default',
          enableVibrate:     true,
        }).catch(() => {});
        // commandes-v3 : son vocal bundlé (actif après rebuild)
        N.setNotificationChannelAsync('commandes-v3', {
          name:              'Commandes (son vocal)',
          importance:        N.AndroidImportance.MAX,
          vibrationPattern:  [0, 300, 200, 300],
          lightColor:        '#FDCF34',
          sound:             'commande_recue',
          enableVibrate:     true,
        }).catch(() => {});
        N.setNotificationChannelAsync('messages-v2', {
          name:          'Messages',
          importance:    N.AndroidImportance.HIGH,
          sound:         'default',
          enableVibrate: true,
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

  // Annonce vocale foreground iOS + Android : déclenche Speech quand une notif commande/réservation arrive
  useEffect(() => {
    try {
      const N = getN();
      if (!N || Platform.OS === 'web') return;
      const sub = N.addNotificationReceivedListener((notification) => {
        try {
          const data  = notification.request.content.data as Record<string, any>;
          const type  = data?.type as string | undefined;
          const isOrder = type === 'new_order' || type === 'commande';
          const isResa  = type === 'reservation' || type === 'new_reservation' || type === 'table_reservation';
          if (!isOrder && !isResa) return;
          const text = isResa ? 'Nouvelle réservation reçue' : 'Nouvelle commande reçue';
          const opts = { language: 'fr-FR', rate: 0.78, pitch: 1.0, volume: 1 } as const;
          Speech.stop();
          Speech.speak(text, opts);
          setTimeout(() => { try { Speech.speak(text, opts); } catch { /* ignore */ } }, 3000);
          setTimeout(() => { try { Speech.speak(text, opts); } catch { /* ignore */ } }, 6000);
        } catch { /* best-effort */ }
      });
      return () => { try { sub.remove(); } catch { /* ignore */ } };
    } catch {
      return undefined;
    }
  }, []);

  // Firebase foreground message handler (iOS + Android) — Expo setNotificationHandler
  // n'intercepte pas les messages Firebase avec useFrameworks:static → sans ce handler,
  // les notifications sont silencieuses en foreground sur iOS.
  useEffect(() => {
    if (IS_EXPO_GO || Platform.OS === 'web') return;
    let unsub: (() => void) | null = null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const messaging = require('@react-native-firebase/messaging').default;
      const N = getN();
      unsub = messaging().onMessage(async (remoteMessage: Record<string, any>) => {
        if (!N) return;
        const notif = remoteMessage.notification ?? {};
        const title = notif.title ?? remoteMessage.data?.title ?? '';
        const body  = notif.body  ?? remoteMessage.data?.body  ?? '';
        if (!title && !body) return;
        // Annonce vocale Android foreground (addNotificationReceivedListener ne reçoit
        // pas les messages Firebase sur Android — on doit le faire ici)
        if (Platform.OS === 'android') {
          try {
            const type     = remoteMessage.data?.type as string | undefined;
            const isOrder  = type === 'new_order' || type === 'commande';
            const isResa   = type === 'reservation' || type === 'new_reservation' || type === 'table_reservation';
            if (isOrder || isResa) {
              const text = isResa ? 'Nouvelle réservation reçue' : 'Nouvelle commande reçue';
              const opts = { language: 'fr-FR', rate: 0.78, pitch: 1.0, volume: 1 } as const;
              Speech.stop();
              Speech.speak(text, opts);
              setTimeout(() => { try { Speech.speak(text, opts); } catch { /* ignore */ } }, 3000);
              setTimeout(() => { try { Speech.speak(text, opts); } catch { /* ignore */ } }, 6000);
            }
          } catch { /* best-effort */ }
        }
        // iOS UNIQUEMENT : useFrameworks:static casse l'interception Expo des
        // messages Firebase en foreground → on réaffiche manuellement.
        // Sur Android, expo-notifications affiche DÉJÀ la notif via
        // setNotificationHandler → ce scheduleNotificationAsync ferait DOUBLON.
        if (Platform.OS === 'ios') {
          try {
            await N.scheduleNotificationAsync({
              content: { title, body, sound: 'default', data: remoteMessage.data ?? {} },
              trigger: null,
            });
          } catch (_) {}
        }
      });
    } catch (_) {}
    return () => { try { unsub?.(); } catch (_) {} };
  }, []);

  // Écoute les changements Supabase (login, token refresh, déconnexion explicite…)
  // SESSION GUARDIAN : on ne réagit à user=null QUE si c'est une déconnexion explicite
  // (bouton "Se déconnecter"). Les SIGNED_OUT involontaires (réseau Android instable,
  // refresh_token reuse detection) sont déjà filtrés dans auth.ts → ce callback ne
  // reçoit null que via _explicitSignOut. Ne jamais setUser(null) ici sur un null
  // réseau — l'utilisateur a un cachedUser dans authStore qui le maintient connecté.
  useEffect(() => {
    const unsubscribe = authService.onAuthStateChange((user) => {
      if (user) {
        // Toujours accepter un utilisateur valide (login, token refresh)
        useAuthStore.getState().setUser(user);
      } else {
        // user=null ne peut arriver ici que via _explicitSignOut (voir auth.ts).
        // On kick vers auth UNIQUEMENT dans ce cas, jamais sur erreur réseau.
        // eslint-disable-next-line no-console
        console.warn('[LASSI/auth] onAuthStateChange user=null (explicit signOut) — screen=', screen);
        useAuthStore.getState().setUser(null);
        if (screen !== 'splash' && screen !== 'onboarding' && screen !== 'auth' && screen !== 'guest') {
          setScreen('auth');
        }
      }
    });
    return unsubscribe;
  }, [screen]);

  // Intercepte l'event PASSWORD_RECOVERY (lien email reset-password)
  useEffect(() => {
    return authService.onPasswordRecovery(() => setScreen('resetPassword'));
  }, []);




  return (
    <View style={styles.root} onLayout={onLayout}>
      <StatusBar style="light" />
      <OfflineBanner />

      {/* Bannière slide-top : commandes/messages (5s) + annonces à la une/nouveau prestataire (3s) + réservations terrain */}
      <NotifPopupBanner
        onView={() => setPendingNav({ type: 'notifications' })}
        onVoirAlaUne={() => setPendingNav({ type: 'a_la_une_feed' })}
        onVoirVitrine={(shopId, shopName) => setPendingNav({ type: 'new_shop', shopId, shopName })}
        onVoirTerrain={(terrainId) => setPendingNav({ type: 'terrain_resa', terrainId })}
      />

      {/* Carte rich-notification pour récompenses et paiements */}
      <NotifCardModal onView={() => setPendingNav({ type: 'notifications' })} />

      {/* Annonces système admin (table annonces) — une seule fois par annonce, file FIFO */}
      <AnnonceModal annonce={annonceCourante} nbRestantes={nbRestantes} onFermer={marquerLue} />

      <ErrorBoundary>
      {screen === 'splash' && (
        <SplashScreen onFinish={async () => {
          try {
            const t0 = Date.now();
            // eslint-disable-next-line no-console
            console.log('[LASSI/splash] onFinish start', { hydrated: useAuthStore.persist.hasHydrated() });

            // Attendre la hydration Zustand si elle n'est pas encore terminée.
            // LargeSecureStore (expo-secure-store + AES) peut être lent sur Android Samsung.
            // Sans ce guard, getState() retourne user=null → kick vers auth screen.
            if (!useAuthStore.persist.hasHydrated()) {
              await new Promise<void>(resolve => {
                const unsub = useAuthStore.persist.onFinishHydration(() => { unsub(); resolve(); });
                setTimeout(resolve, 3000); // fallback 3s max
              });
            }
            // eslint-disable-next-line no-console
            console.log('[LASSI/splash] hydration done', { ms: Date.now() - t0, hydrated: useAuthStore.persist.hasHydrated() });

            const { hasSeenOnboarding, user: cachedUser } = useAuthStore.getState();
            // eslint-disable-next-line no-console
            console.log('[LASSI/splash] cachedUser', { id: cachedUser?.id ?? null, role: cachedUser?.role ?? null });

            // Utilise la promesse lancée au montage (en parallèle avec le splash).
            // Si elle n'existe pas (rare), on en lance une nouvelle avec un timeout court.
            // La session a déjà eu 2,6 s pour charger (pendant l'animation).
            // On attend au max 1 s de plus → sinon on utilise le cachedUser persisté.
            const sessionUser = await Promise.race([
              sessionFetch.current ?? authService.getSessionUser(),
              new Promise<null>((resolve) => setTimeout(() => resolve(null), 1000)),
            ]);
            // eslint-disable-next-line no-console
            console.log('[LASSI/splash] sessionUser', { id: sessionUser?.id ?? null, role: sessionUser?.role ?? null, ms: Date.now() - t0 });

            if (sessionUser) {
              useAuthStore.getState().setUser(sessionUser);
              if (sessionUser.role === 'merchant') { await goMerchant(); }
              else if (sessionUser.role === 'livreur') setScreen('livreur');
              else setScreen('client');
              return;
            }

            // Supabase n'a pas répondu à temps mais on a un utilisateur en cache :
            // ouvrir l'app immédiatement, la session sera re-vérifiée en arrière-plan.
            if (cachedUser) {
              useAuthStore.getState().setUser(cachedUser); // ← indispensable : passe isLoading à false
              if (cachedUser.role === 'merchant') { await goMerchant(); }
              else if (cachedUser.role === 'livreur') setScreen('livreur');
              else setScreen('client');
              return;
            }

            // eslint-disable-next-line no-console
            console.warn('[LASSI/splash] NO USER → setScreen auth', { hasSeenOnboarding });
            useAuthStore.getState().setLoading(false);
            setScreen(hasSeenOnboarding ? 'auth' : 'onboarding');
          } catch (err) {
            // eslint-disable-next-line no-console
            console.error('[LASSI/splash] CATCH', err);
            const { hasSeenOnboarding, user: cachedUser } = useAuthStore.getState();
            if (cachedUser) {
              useAuthStore.getState().setUser(cachedUser);
              if (cachedUser.role === 'merchant') { void goMerchant(); }
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
        <AuthNavigator
          onComplete={(role) => {
            if (role === 'merchant') void goMerchant();
            else if (role === 'livreur') setScreen('livreur');
            else setScreen('client');
          }}
          onGuest={() => setScreen('guest')}
        />
      )}

      {screen === 'guest'    && <HomeNavigator     onLogout={() => setScreen('auth')} onLoginRequired={() => setScreen('auth')} />}
      {screen === 'client'   && <HomeNavigator     onLogout={handleLogout} />}
      {screen === 'merchant' && (
        gerantActive
          ? <GerantNavigator onLogout={handleLogout} />
          : <MerchantNavigator onLogout={handleLogout} />
      )}
      {screen === 'livreur'  && <LivreurNavigator  onLogout={handleLogout} />}

      {screen === 'resetPassword' && (
        <ResetPasswordScreen onDone={() => setScreen('auth')} />
      )}
      </ErrorBoundary>
    </View>
  );
}

export default function App() {
  if (SUPABASE_MISCONFIGURED) return <MisconfiguredScreen />;
  return <AppContent />;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
});
