import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Alert, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MerchantDashboard from './MerchantDashboard';
import MerchantProfileScreen from './MerchantProfileScreen';
import MerchantMessagesScreen from './MerchantMessagesScreen';
import MerchantPaymentsScreen from './MerchantPaymentsScreen';
import MerchantAvisScreen from './MerchantAvisScreen';
import DebtsScreen from './DebtsScreen';
import StoreScreen from './StoreScreen';
import OrdersScreen from './OrdersScreen';
import VisibilityScreen from './VisibilityScreen';
import OffreQuartierScreen from './OffreQuartierScreen';
import CertificatScreen from './CertificatScreen';
import RevenueScreen from './RevenueScreen';
import PromotionsScreen from './PromotionsScreen';
import TerrainScreen from './TerrainScreen';
import TerrainEditScreen from './TerrainEditScreen';
import TerrainReservationsScreen from './TerrainReservationsScreen';
import TerrainScanScreen from './TerrainScanScreen';
import MerchantAbonnementsScreen from '../fitness/MerchantAbonnementsScreen';
import AlaUneScreen from './AlaUneScreen';
import BlocAlaUneScreen from '../home/BlocAlaUneScreen';
import MerchantLivraisonScreen from './MerchantLivraisonScreen';
import MaCampagneScreen from './MaCampagneScreen';
import StoryComposerScreen from './StoryComposerScreen';
import BeautyServiceCatalogScreen from './BeautyServiceCatalogScreen';
import BeautyReservationsScreen from './BeautyReservationsScreen';
import MerchantRestaurantReservationsScreen from '../restaurant/MerchantRestaurantReservationsScreen';
import { Terrain } from '../../types/terrain';
import { getTerrainById } from '../../services/terrains';
import NotificationsScreen from '../home/NotificationsScreen';
import ChatScreen from '../chat/ChatScreen';
import ShopScreen from '../shop/ShopScreen';
import MapScreen from '../home/MapScreen';
import SuiviGPSScreen from '../home/SuiviGPSScreen';
import CartScreen from '../home/CartScreen';
import PaymentScreen from '../payment/PaymentScreen';
import ClientOrdersScreen from '../home/ClientOrdersScreen';
import LassiAssistantScreen from '../home/LassiAssistantScreen';
import ClassementScreen from '../classement/ClassementScreen';
import WelcomeVitrineModal from '../../components/merchant/WelcomeVitrineModal';
import WelcomeRewardBanner from '../../components/merchant/WelcomeRewardBanner';
import ShareVitrineModal from '../../components/merchant/ShareVitrineModal';
import { supabase } from '../../lib/supabase';
import useShopStore from '../../store/shopStore';
import useAuthStore from '../../store/authStore';
import useNotificationsStore from '../../store/notificationsStore';
import useNotifPopupStore from '../../store/notifPopupStore';
import usePendingNavStore from '../../store/pendingNavStore';
import { useRealtimeNotifications } from '../../hooks/useRealtimeNotifications';
import { getRecompenseBienvenue } from '../../services/classementService';
import { OrderInfo } from '../../types/payment';

function shouldShowCard(type: string): boolean {
  return type === 'vip' || type === 'pay' || type === 'payment' || type === 'order' || type === 'msg' || type === 'fitness' || type === 'reservation_terrain' || type === 'setup_shop' || type === 'share_vitrine';
}

// Navigateur du cockpit prestataire — tous les modules sont câblés ici.
type MerchantScreen =
  | 'dashboard'
  | 'debts'
  | 'store'
  | 'orders'
  | 'messages'
  | 'visibility'
  | 'offre_quartier'
  | 'certificat'
  | 'profile'
  | 'notifications'
  | 'revenue'
  | 'preview'
  | 'payments'
  | 'promotions'
  | 'assistant'
  | 'aroundme'
  | 'myorders'
  | 'avis'
  | 'classement'
  | { id: 'chat'; conversationId: string }
  | { id: 'buyerShop'; shopId: string; shopName: string; backTo?: 'aroundme' | 'assistant' }
  | { id: 'buyerCart'; shopId: string; shopName: string; backTo?: 'aroundme' | 'assistant' }
  | {
      id: 'buyerChat';
      shopId: string;
      shopName: string;
      shopLogoUrl?: string | null;
      backTo?: 'aroundme' | 'assistant';
    }
  | {
      id: 'buyerPayment';
      order: OrderInfo;
      shopId: string;
      shopName: string;
      from: 'cart' | 'chat';
      backTo?: 'aroundme' | 'assistant';
    }
  | 'terrains'
  | { id: 'terrain_edit'; terrain?: Terrain }
  | { id: 'terrain_reservations'; terrain: Terrain }
  | 'terrain_scan'
  | { id: 'suivi_gps'; shopLat: number; shopLng: number; shopName: string; shopLogoUrl: string | null }
  | 'fitness_abonnements'
  | 'beauty_services'
  | 'beauty_reservations'
  | { id: 'beauty_reservations'; date?: string }
  | 'restaurant_reservations'
  | 'a_la_une'
  | { id: 'a_la_une_bloc'; blocCode: string; elementIndex?: number }
  | 'livraison'
  | 'ma_campagne'
  | 'ca_bouge'
  | { id: 'orders'; initialTab: 'new' | 'preparing' }
;

interface Props {
  onLogout: () => void;
}

export default function MerchantNavigator({ onLogout }: Props) {
  const [screen, setScreen] = useState<MerchantScreen>('dashboard');
  const shopId    = useShopStore(s => s.shopId);
  const shopSlug  = useShopStore(s => s.profile?.slug ?? null);
  const shopName  = useShopStore(s => s.profile?.name ?? 'Ma boutique');

  // Persiste le filtre/recherche de la carte entre navigations
  const [mapFilter, setMapFilter] = useState('all');
  const [mapSearch, setMapSearch] = useState('');

  // Mémorise l'écran d'origine de "Mes terrains" et "Ma vitrine" pour le retour
  const [terrainsFrom, setTerrainsFrom] = useState<'dashboard' | 'profile'>('dashboard');
  const [storeFrom,      setStoreFrom]      = useState<'dashboard' | 'profile'>('dashboard');
  const [visibilityFrom, setVisibilityFrom] = useState<'dashboard' | 'profile'>('dashboard');
  const userId      = useAuthStore(s => s.user?.id ?? null);
  const addNotif    = useNotificationsStore(s => s.addNotif);
  const enqueueCard = useNotifPopupStore(s => s.enqueue);
  const cardReady   = useNotifPopupStore(s => s.ready);

  const pendingNav   = usePendingNavStore(s => s.pendingNav);
  const clearPending = usePendingNavStore(s => s.clearPendingNav);

  // Modal de bienvenue → configurer sa vitrine (affichée une seule fois)
  const [showVitrineModal, setShowVitrineModal] = useState(false);
  // Banner cadeau "Offre du Quartier" (affiché une seule fois)
  const [showRewardBanner, setShowRewardBanner] = useState(false);
  const [welcomeCarrousel, setWelcomeCarrousel] = useState(4);
  // Rappel "Partagez votre vitrine" (lundi/jeudi, in-app only)
  const [shareReminderId, setShareReminderId] = useState<string | null>(null);
  // IDs déjà affichés dans cette session : évite la réapparition après "Plus tard"
  // (le mark serveur est fire-and-forget, un refetch peut le devancer).
  const shownShareRemindersRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!userId) return;
    // Modal vitrine
    AsyncStorage.getItem(`lassi_welcome_vitrine_shown_${userId}`).then(val => {
      if (!val) setShowVitrineModal(true);
    }).catch(() => {});
    // Banner cadeau (seulement si récompense active)
    AsyncStorage.getItem(`lassi_welcome_shown_${userId}`).then(val => {
      if (val) return;
      getRecompenseBienvenue(userId).then(r => {
        if (!r || !r.est_actif) return;
        setWelcomeCarrousel(r.carrousel_produits > 0 ? r.carrousel_produits : 4);
        setShowRewardBanner(true);
      }).catch(() => {});
    }).catch(() => {});
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const dismissVitrineModal = () => {
    setShowVitrineModal(false);
    if (userId) AsyncStorage.setItem(`lassi_welcome_vitrine_shown_${userId}`, '1').catch(() => {});
  };

  const handleVitrineConfigure = () => {
    dismissVitrineModal();
    setStoreFrom('dashboard');
    setScreen('store');
  };

  const dismissRewardBanner = () => {
    setShowRewardBanner(false);
    if (userId) AsyncStorage.setItem(`lassi_welcome_shown_${userId}`, '1').catch(() => {});
  };

  const handleRewardDiscover = () => {
    dismissRewardBanner();
    setScreen('offre_quartier');
  };

  // Realtime : badge + carte pour les notifs importantes
  useRealtimeNotifications(userId, notif => {
    addNotif(notif);
    if (shouldShowCard(notif.type)) enqueueCard(notif);
  });

  // Démarrage : badge + cartes pour les notifs non lues importantes (un seul appel DB)
  useEffect(() => {
    if (!userId || !cardReady) return;
    useNotificationsStore.getState().loadNotifications().then(() => {
      const notifs = useNotificationsStore.getState().notifications;
      [...notifs].reverse().forEach(n => {
        if (n.unread && shouldShowCard(n.type)) enqueueCard(n);
      });
    }).catch(() => {});
  }, [userId, cardReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Rappel "Partagez votre vitrine" (lundi/jeudi, in-app only) ──────────────
  // Le cron serveur crée un rappel "pending" chaque lundi/jeudi. Dès que le
  // prestataire ouvre l'app ce jour-là → modal. Marqué "shown" à l'affichage
  // (pas de re-nag). S'il n'ouvre pas de la journée, le cron le bascule dans sa
  // messagerie (aucun push, tout reste in-app).
  const checkShareReminder = useCallback(async () => {
    if (!userId || !shopSlug || shareReminderId) return;
    try {
      const { data } = await supabase.rpc('get_pending_share_reminder');
      const row = Array.isArray(data) ? data[0] : data;
      if (row?.id && !shownShareRemindersRef.current.has(row.id as string)) {
        shownShareRemindersRef.current.add(row.id as string);
        setShareReminderId(row.id as string);
        // Fire-and-forget : marque vu dès l'affichage
        supabase.rpc('mark_share_reminder_shown', { p_id: row.id });
      }
    } catch { /* réseau : réessai au prochain foreground */ }
  }, [userId, shopSlug, shareReminderId]);

  useEffect(() => { void checkShareReminder(); }, [checkShareReminder]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', st => {
      if (st === 'active') void checkShareReminder();
    });
    return () => sub.remove();
  }, [checkShareReminder]);

  // Deep link depuis notification push ou retour paiement
  useEffect(() => {
    if (!pendingNav) return;
    clearPending();
    if (pendingNav.type === 'home') {
      setScreen('dashboard');
    } else if (pendingNav.type === 'notifications') {
      setScreen('notifications');
    } else if (pendingNav.type === 'msg') {
      setScreen({ id: 'chat', conversationId: pendingNav.conversationId });
    } else if (pendingNav.type === 'order') {
      setScreen('orders');
    } else if (pendingNav.type === 'payment_success') {
      setScreen('orders');
    } else if (pendingNav.type === 'payment_failed') {
      Alert.alert(
        'Paiement échoué',
        "Le paiement n'a pas pu être confirmé. Réessayez ou choisissez un autre moyen de paiement.",
      );
      setScreen('payments');
    } else if (pendingNav.type === 'a_la_une_bloc') {
      setScreen({ id: 'a_la_une_bloc', blocCode: pendingNav.blocCode, elementIndex: pendingNav.elementIndex });
    } else if (pendingNav.type === 'a_la_une_categorie') {
      // Pour le prestataire en mode acheteur, on revient au dashboard
      setScreen('dashboard');
    } else if (pendingNav.type === 'terrain_resa') {
      const tId = pendingNav.terrainId;
      if (tId) {
        getTerrainById(tId)
          .then(t => setScreen(t ? { id: 'terrain_reservations', terrain: t } : 'terrains'))
          .catch(() => setScreen('terrains'));
      } else {
        setScreen('terrains');
      }
    } else if (pendingNav.type === 'beauty_resa') {
      setScreen({ id: 'beauty_reservations', date: pendingNav.date });
    } else if (pendingNav.type === 'table_resa_prestataire') {
      setScreen('restaurant_reservations');
    } else if (pendingNav.type === 'visibility_campaign') {
      setScreen('ma_campagne');
    } else if (pendingNav.type === 'offre_quartier') {
      setScreen('offre_quartier');
    } else if (pendingNav.type === 'ma_vitrine') {
      setStoreFrom('dashboard');
      setScreen('store');
    }
  }, [pendingNav, clearPending]);

  // ── Mes achats (prestataire en mode acheteur) ─────────────────────────────
  if (screen === 'myorders') {
    return (
      <ClientOrdersScreen
        onBack={() => setScreen('profile')}
        onExplore={() => setScreen('aroundme')}
        onGoToCart={(shopId, shopName) => setScreen({ id: 'buyerCart', shopId, shopName })}
      />
    );
  }

  // ── Suivi GPS en app (prestataire en mode acheteur) ──────────────────────
  if (typeof screen === 'object' && screen.id === 'suivi_gps') {
    return (
      <SuiviGPSScreen
        shopLat={screen.shopLat}
        shopLng={screen.shopLng}
        shopName={screen.shopName}
        shopLogoUrl={screen.shopLogoUrl}
        onBack={() => setScreen('aroundme')}
      />
    );
  }

  // ── Carte "Autour de moi" ─────────────────────────────────────────────────
  if (screen === 'aroundme') {
    return (
      <MapScreen
        onBack={() => setScreen('dashboard')}
        excludeShopId={shopId ?? undefined}
        onShopPress={(sid, sname) => setScreen({ id: 'buyerShop', shopId: sid, shopName: sname })}
        initialFilter={mapFilter}
        initialSearchQuery={mapSearch}
        onFilterChange={setMapFilter}
        onSearchChange={setMapSearch}
        onRouteSuivi={params => setScreen({ id: 'suivi_gps', ...params })}
      />
    );
  }

  // ── Flux acheteur : vitrine ────────────────────────────────────────────────
  if (typeof screen === 'object' && screen.id === 'buyerShop') {
    const backDest = screen.backTo ?? 'aroundme';
    return (
      <ShopScreen
        shopId={screen.shopId}
        shopName={screen.shopName}
        onBack={() => setScreen(backDest)}
        onChat={logoUrl =>
          setScreen({
            id: 'buyerChat',
            shopId: screen.shopId,
            shopName: screen.shopName,
            shopLogoUrl: logoUrl,
            backTo: screen.backTo,
          })
        }
        onCheckout={() =>
          setScreen({
            id: 'buyerCart',
            shopId: screen.shopId,
            shopName: screen.shopName,
            backTo: screen.backTo,
          })
        }
        onSuivi={params => setScreen({ id: 'suivi_gps', ...params })}
      />
    );
  }

  // ── Flux acheteur : panier ────────────────────────────────────────────────
  if (typeof screen === 'object' && screen.id === 'buyerCart') {
    return (
      <CartScreen
        shopId={screen.shopId}
        shopName={screen.shopName}
        onBack={() =>
          setScreen({
            id: 'buyerShop',
            shopId: screen.shopId,
            shopName: screen.shopName,
            backTo: screen.backTo,
          })
        }
        onCheckout={order =>
          setScreen({
            id: 'buyerPayment',
            order,
            shopId: screen.shopId,
            shopName: screen.shopName,
            from: 'cart',
            backTo: screen.backTo,
          })
        }
      />
    );
  }

  // ── Flux acheteur : chat ──────────────────────────────────────────────────
  if (typeof screen === 'object' && screen.id === 'buyerChat') {
    return (
      <ChatScreen
        shopId={screen.shopId}
        shopInitial={screen.shopName.charAt(0).toUpperCase()}
        shopName={screen.shopName}
        shopLogoUrl={screen.shopLogoUrl}
        isVip={false}
        onBack={() =>
          setScreen({
            id: 'buyerShop',
            shopId: screen.shopId,
            shopName: screen.shopName,
            backTo: screen.backTo,
          })
        }
        onCheckout={order =>
          setScreen({
            id: 'buyerPayment',
            order,
            shopId: screen.shopId,
            shopName: screen.shopName,
            from: 'chat',
            backTo: screen.backTo,
          })
        }
      />
    );
  }

  // ── Flux acheteur : paiement ──────────────────────────────────────────────
  if (typeof screen === 'object' && screen.id === 'buyerPayment') {
    return (
      <PaymentScreen
        order={screen.order}
        onBack={() =>
          setScreen({
            id: 'buyerCart',
            shopId: screen.shopId,
            shopName: screen.shopName,
            backTo: screen.backTo,
          })
        }
        onSuccess={() => setScreen('myorders')}
      />
    );
  }

  // ── Assistant Lassi ────────────────────────────────────────────────────────
  if (screen === 'assistant') {
    return (
      <LassiAssistantScreen
        onClose={() => setScreen('dashboard')}
        onShopPress={(sid, sname) =>
          setScreen({ id: 'buyerShop', shopId: sid, shopName: sname, backTo: 'assistant' })
        }
      />
    );
  }

  // ── Chat direct (depuis une notification de message) ──────────────────────
  if (typeof screen === 'object' && screen.id === 'chat') {
    return (
      <ChatScreen
        conversationId={screen.conversationId}
        shopInitial="?"
        shopName="…"
        onBack={() => setScreen('dashboard')}
      />
    );
  }

  if (screen === 'notifications')
    return (
      <NotificationsScreen
        onBack={() => setScreen('dashboard')}
        onNavigate={(type, targetId, data) => {
          const d = data ?? {};
          // Ça bouge (réaction / commentaire sur ma story) → mes stories (répondre)
          if (d.type === 'ca_bouge') {
            setScreen('ca_bouge');
            return;
          }
          // Réservation beauté → écran dédié (à la bonne date), PAS l'écran Commandes
          if (d.type === 'beauty_reservation' || d.type === 'beauty_acces_valide') {
            setScreen({ id: 'beauty_reservations', date: d.dateResa as string | undefined });
            return;
          }
          // Nouvelle réservation de table → écran Réservations de table, PAS l'écran Commandes
          if (d.type === 'table_reservation_nouvelle') {
            setScreen('restaurant_reservations');
            return;
          }
          if (type === 'msg' && targetId) {
            // 1 tap → directement dans la bonne conversation
            setScreen({ id: 'chat', conversationId: targetId });
            return;
          }
          if (type === 'reservation_terrain') {
            const terrainId = (data ?? {}).terrainId as string | undefined;
            if (terrainId) {
              getTerrainById(terrainId)
                .then(terrain => { if (terrain) setScreen({ id: 'terrain_reservations', terrain }); else setScreen('terrains'); })
                .catch(() => setScreen('terrains'));
            } else {
              setScreen('terrains');
            }
            return;
          }
          if (type === 'fitness') {
            // Abonnement sport payé → liste des abonnés
            setScreen('fitness_abonnements');
            return;
          }
          // Pack de visibilité activé (Wave·OM·crédit) → PAS l'écran Commandes.
          // Quartier → écran « Offre du Quartier » (choix des produits mis en avant) ;
          // annonce / recherche / carte → « Ma Campagne ».
          if (d.subscription_id) {
            setScreen(d.offer_type === 'quartier' ? 'offre_quartier' : 'ma_campagne');
            return;
          }
          if (type === 'order' || type === 'pay') {
            setScreen('orders');
            return;
          }
          if (type === 'vip') {
            // Mise à jour de classement (hebdo ou mérite sous-catégorie) → écran Classement
            if (d.sous_categorie || d.type_classement === 'sous_categorie') {
              setScreen('classement');
              return;
            }
            // Cadeau (bienvenue, manuel, mérite mondial) → où l'appliquer : Offre du Quartier
            setScreen('offre_quartier');
          }
        }}
      />
    );
  if (screen === 'beauty_services')
    return <BeautyServiceCatalogScreen onBack={() => setScreen('store')} />;

  if (screen === 'beauty_reservations')
    return <BeautyReservationsScreen onBack={() => setScreen('store')} />;

  if (typeof screen === 'object' && screen.id === 'beauty_reservations')
    return <BeautyReservationsScreen initialDate={screen.date} onBack={() => setScreen('dashboard')} />;

  if (screen === 'restaurant_reservations')
    return <MerchantRestaurantReservationsScreen onBack={() => setScreen('store')} />;

  if (screen === 'terrain_scan') return <TerrainScanScreen onBack={() => setScreen('terrains')} />;

  if (typeof screen === 'object' && screen.id === 'terrain_edit')
    return (
      <TerrainEditScreen
        terrain={screen.terrain}
        onBack={() => setScreen('terrains')}
        onSaved={() => setScreen('terrains')}
      />
    );

  if (typeof screen === 'object' && screen.id === 'terrain_reservations')
    return (
      <TerrainReservationsScreen terrain={screen.terrain} onBack={() => setScreen('terrains')} />
    );

  if (screen === 'terrains')
    return (
      <TerrainScreen
        onBack={() => setScreen(terrainsFrom)}
        onAddTerrain={() => setScreen({ id: 'terrain_edit' })}
        onEditTerrain={t => setScreen({ id: 'terrain_edit', terrain: t })}
        onTerrainReservations={t => setScreen({ id: 'terrain_reservations', terrain: t })}
      />
    );

  if (screen === 'preview')
    return <ShopScreen shopId={shopId ?? ''} onBack={() => setScreen('store')} isPreview={true} />;
  if (screen === 'avis') return <MerchantAvisScreen onBack={() => setScreen('dashboard')} />;
  if (screen === 'classement')
    return <ClassementScreen variant="prestataire" onBack={() => setScreen('dashboard')} />;
  if (screen === 'debts') return <DebtsScreen onBack={() => setScreen('dashboard')} />;
  if (screen === 'ca_bouge') return <StoryComposerScreen onBack={() => setScreen('dashboard')} />;

  if (screen === 'promotions') return <PromotionsScreen onBack={() => setScreen('store')} />;
  if (screen === 'fitness_abonnements')
    return <MerchantAbonnementsScreen onBack={() => setScreen('store')} />;
  if (screen === 'a_la_une') return <AlaUneScreen onBack={() => setScreen('dashboard')} />;
  if (screen === 'livraison') return <MerchantLivraisonScreen onBack={() => setScreen('dashboard')} />;
  if (typeof screen === 'object' && screen.id === 'a_la_une_bloc')
    return (
      <BlocAlaUneScreen
        blocCode={screen.blocCode}
        elementIndex={screen.elementIndex}
        onBack={() => setScreen('dashboard')}
        onShopPress={(sid, sname) => setScreen({ id: 'buyerShop', shopId: sid, shopName: sname })}
        onPaymentPress={order =>
          setScreen({ id: 'buyerPayment', order, shopId: '', shopName: order.shopName, from: 'cart' })
        }
      />
    );

  if (screen === 'store')
    return (
      <StoreScreen
        onBack={() => setScreen(storeFrom)}
        onPreview={() => setScreen('preview')}
        onPromos={() => setScreen('promotions')}
        onAbonnes={() => setScreen('fitness_abonnements')}
        onManageBeautyServices={() => setScreen('beauty_services')}
        onBeautyReservations={() => setScreen('beauty_reservations')}
        onRestaurantReservations={() => setScreen('restaurant_reservations')}
      />
    );
  if (screen === 'orders')
    return (
      <OrdersScreen
        onBack={() => setScreen('dashboard')}
        onOpenChat={cid => setScreen({ id: 'chat', conversationId: cid })}
      />
    );
  if (typeof screen === 'object' && screen.id === 'orders')
    return (
      <OrdersScreen
        initialTab={screen.initialTab}
        onBack={() => setScreen('dashboard')}
        onOpenChat={cid => setScreen({ id: 'chat', conversationId: cid })}
      />
    );
  if (screen === 'messages')
    return <MerchantMessagesScreen onBack={() => setScreen('dashboard')} />;
  if (screen === 'visibility') return <VisibilityScreen onBack={() => setScreen(visibilityFrom)} />;
  if (screen === 'offre_quartier')
    return <OffreQuartierScreen onBack={() => setScreen('profile')} />;
  if (screen === 'ma_campagne')
    return <MaCampagneScreen onBack={() => setScreen('profile')} />;
  if (screen === 'certificat') return <CertificatScreen onBack={() => setScreen('profile')} />;
  if (screen === 'revenue') return <RevenueScreen onBack={() => setScreen('profile')} />;
  if (screen === 'payments') return <MerchantPaymentsScreen onBack={() => setScreen('profile')} />;
  if (screen === 'profile')
    return (
      <MerchantProfileScreen
        onBack={() => setScreen('dashboard')}
        onStore={() => { setStoreFrom('profile'); setScreen('store'); }}
        onTerrains={() => {
          setTerrainsFrom('profile');
          setScreen('terrains');
        }}
        onVisibility={() => { setVisibilityFrom('profile'); setScreen('visibility'); }}
        onOffreQuartier={() => setScreen('offre_quartier')}
        onMaCampagne={() => setScreen('ma_campagne')}
        onRevenue={() => setScreen('revenue')}
        onPayments={() => setScreen('payments')}
        onMyOrders={() => setScreen('myorders')}
        onLogout={onLogout}
      />
    );

  return (
    <>
      <MerchantDashboard
        onNavigate={dest => {
          if (dest === 'debts') setScreen('debts');
          if (dest === 'store') { setStoreFrom('dashboard'); setScreen('store'); }
          if (dest === 'orders') setScreen('orders');
          if (dest === 'messages') setScreen('messages');
          if (dest === 'visibility') { setVisibilityFrom('dashboard'); setScreen('visibility'); }
          if (dest === 'profile') setScreen('profile');
          if (dest === 'notifications') setScreen('notifications');
          if (dest === 'assistant') setScreen('assistant');
          if (dest === 'aroundme') setScreen('aroundme');
          if (dest === 'avis') setScreen('avis');
          if (dest === 'terrains') {
            setTerrainsFrom('dashboard');
            setScreen('terrains');
          }
          if (dest === 'classement') setScreen('classement');
          if (dest === 'offre_quartier') setScreen('offre_quartier');
          if (dest === 'a_la_une') setScreen('a_la_une');
          if (dest === 'ca_bouge') setScreen('ca_bouge');
          if (dest === 'livraison') setScreen('livraison');
        }}
        onOrderPress={(_, tab) => setScreen({ id: 'orders', initialTab: tab })}
        onNotifPress={() => setScreen('notifications')}
      />
      <WelcomeVitrineModal
        visible={showVitrineModal}
        onClose={dismissVitrineModal}
        onConfigure={handleVitrineConfigure}
      />
      {showRewardBanner && (
        <WelcomeRewardBanner
          carrouselProduits={welcomeCarrousel}
          onDiscover={handleRewardDiscover}
          onDismiss={dismissRewardBanner}
        />
      )}
      {!!shareReminderId && !!shopSlug && !showVitrineModal && (
        <ShareVitrineModal
          visible
          slug={shopSlug}
          shopName={shopName}
          onClose={() => setShareReminderId(null)}
        />
      )}
    </>
  );
}
