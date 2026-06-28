import React, { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import logger from '../../utils/logger';
import ClientHomeScreen from './ClientHomeScreen';
import ClientProfileScreen from './ClientProfileScreen';
import ClientOrdersScreen from './ClientOrdersScreen';
import ClientMessagesScreen from './ClientMessagesScreen';
import LassiAssistantScreen from './LassiAssistantScreen';
import SearchScreen from './SearchScreen';
import NotificationsScreen from './NotificationsScreen';
import FavoritesScreen from './FavoritesScreen';
import RecentlyViewedScreen from './RecentlyViewedScreen';
import CartScreen from './CartScreen';
import MapScreen from './MapScreen';
import SuiviGPSScreen from './SuiviGPSScreen';
import ReceiptScreen from './ReceiptScreen';
import CategoryScreen from '../category/CategoryScreen';
import ShopScreen from '../shop/ShopScreen';
import ChatScreen from '../chat/ChatScreen';
import PaymentScreen from '../payment/PaymentScreen';
import TerrainBookingScreen from '../terrain/TerrainBookingScreen';
import TerrainPaymentScreen from '../terrain/TerrainPaymentScreen';
import TerrainQRScreen from '../terrain/TerrainQRScreen';
import TerrainsListScreen from '../terrain/TerrainsListScreen';
import TerrainDetailScreen from '../terrain/TerrainDetailScreen';
import TerrainMyReservationsScreen from '../terrain/TerrainMyReservationsScreen';
import ClassementScreen from '../classement/ClassementScreen';
import { CatId } from '../../components/category/CatNavBar';
import { OrderInfo } from '../../types/payment';
import { Terrain, SportType } from '../../types/terrain';
import useAuthStore from '../../store/authStore';
import useNotificationsStore from '../../store/notificationsStore';
import useNotifPopupStore from '../../store/notifPopupStore';
import usePendingNavStore from '../../store/pendingNavStore';
import { useRealtimeNotifications } from '../../hooks/useRealtimeNotifications';
import { recordView } from '../../services/recentlyViewed';

function shouldShowCard(type: string): boolean {
  return type === 'vip' || type === 'pay' || type === 'ann';
}

// ─── Stack de navigation client ───────────────────────────────────────────────

type HomeStack =
  | { id: 'main' }
  | { id: 'profile' }
  | { id: 'classement' }
  | { id: 'orders' }
  | { id: 'voice' }
  | { id: 'search' }
  | { id: 'notifications' }
  | { id: 'favorites' }
  | { id: 'recent' }
  | { id: 'messages' }
  | { id: 'map' }
  | { id: 'suivi_gps'; shopLat: number; shopLng: number; shopName: string; shopLogoUrl: string | null }
  | { id: 'cart'; shopId: string; shopName: string }
  | { id: 'category'; catId: CatId; title: string; subCatId?: string }
  | { id: 'shop'; shopId: string; shopName: string; targetProductId?: string }
  | {
      id: 'chat';
      shopId?: string;
      conversationId?: string;
      shopInitial: string;
      shopName: string;
      shopLogoUrl?: string | null;
      isVip: boolean;
      paidTicketId?: string;
    }
  | {
      id: 'payment';
      order: OrderInfo;
      from: 'chat' | 'shop' | 'cart';
      shopId?: string;
      shopName?: string;
    }
  | { id: 'receipt'; orderId: string }
  | { id: 'terrain_list'; sport?: SportType }
  | { id: 'terrain_my_reservations' }
  | { id: 'terrain_detail'; terrain: Terrain }
  | { id: 'terrain_booking'; terrain: Terrain; prestataireName: string }
  | {
      id: 'terrain_payment';
      terrainId: string;
      terrainNom: string;
      prestataireId: string;
      prestataireName: string;
      dateReservation: string;
      heureDebut: string;
      heureFin: string;
      dureeHeures: number;
      prixTotal: number;
    }
  | {
      id: 'terrain_qr';
      receiptCode: string;
      terrainNom: string;
      dateReservation: string;
      heureDebut: string;
      heureFin: string;
      prestataireName: string;
      prixTotal: number;
    };

interface Props {
  onLogout: () => void;
}

export default function HomeNavigator({ onLogout }: Props) {
  const [history, setHistory] = useState<HomeStack[]>([{ id: 'main' }]);

  const screen = history[history.length - 1];
  const push = (s: HomeStack) => setHistory(h => [...h, s]);
  const pop = () => setHistory(h => (h.length > 1 ? h.slice(0, -1) : h));

  // Persiste le filtre/recherche de la carte entre navigations
  const [mapFilter, setMapFilter] = useState('all');
  const [mapSearch, setMapSearch] = useState('');

  // Enregistre la visite dans recently_viewed puis navigue vers la vitrine
  const pushShop = (shopId: string, shopName: string) => {
    recordView(shopId).catch(err => logger.warn('[HomeNavigator] recordView:', err));
    push({ id: 'shop', shopId, shopName });
  };

  // Navigation depuis PromoBanner — ouvre la vitrine et pointe l'article cliqué
  const pushShopItem = (shopId: string, shopName: string, productId: string) => {
    recordView(shopId).catch(err => logger.warn('[HomeNavigator] recordView:', err));
    push({ id: 'shop', shopId, shopName, targetProductId: productId });
  };

  // Abonnement Realtime + carte rich au démarrage
  const userId       = useAuthStore(s => s.user?.id ?? null);
  const addNotif     = useNotificationsStore(s => s.addNotif);
  const enqueueCard  = useNotifPopupStore(s => s.enqueue);
  const cardReady    = useNotifPopupStore(s => s.ready);
  const pendingNav   = usePendingNavStore(s => s.pendingNav);
  const clearPending = usePendingNavStore(s => s.clearPendingNav);

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
      // Oldest-first → la plus ancienne s'affiche en premier
      [...notifs].reverse().forEach(n => {
        if (n.unread && shouldShowCard(n.type)) enqueueCard(n);
      });
    }).catch(() => {});
  }, [userId, cardReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // Deep link depuis notification push (app fermée / arrière-plan)
  useEffect(() => {
    if (!pendingNav) return;
    clearPending();
    if (pendingNav.type === 'home') {
      setHistory([{ id: 'main' }]);
    } else if (pendingNav.type === 'notifications') {
      push({ id: 'notifications' });
    } else if (pendingNav.type === 'msg') {
      setHistory([
        { id: 'main' },
        {
          id: 'chat',
          conversationId: pendingNav.conversationId,
          shopInitial: '?',
          shopName: '…',
          isVip: false,
        },
      ]);
    } else if (pendingNav.type === 'order') {
      setHistory([{ id: 'main' }, { id: 'orders' }]);
    } else if (pendingNav.type === 'payment_success') {
      setHistory([{ id: 'main' }, { id: 'orders' }]);
    } else if (pendingNav.type === 'payment_failed') {
      Alert.alert(
        'Paiement échoué',
        "Le paiement n'a pas pu être confirmé. Réessaie ou contacte le support.",
      );
    }
  }, [pendingNav, clearPending]);

  // ── Paiement ──────────────────────────────────────────────────────────────
  if (screen.id === 'payment') {
    return (
      <PaymentScreen
        order={screen.order}
        onBack={pop}
        onSuccess={ticketId => {
          if (screen.from === 'chat') {
            setHistory([
              { id: 'main' },
              {
                id: 'chat',
                shopId: screen.shopId ?? '',
                shopInitial: screen.order.shopInitial,
                shopName: screen.order.shopName,
                isVip: false,
                paidTicketId: ticketId,
              },
            ]);
          } else {
            setHistory([{ id: 'main' }]);
          }
        }}
      />
    );
  }

  // ── Panier ───────────────────────────────────────────────────────────────
  if (screen.id === 'cart') {
    return (
      <CartScreen
        shopId={screen.shopId}
        shopName={screen.shopName}
        onBack={pop}
        onCheckout={order =>
          push({
            id: 'payment',
            order,
            from: 'cart',
            shopId: screen.shopId,
            shopName: screen.shopName,
          })
        }
      />
    );
  }

  // ── Chat ─────────────────────────────────────────────────────────────────
  if (screen.id === 'chat') {
    return (
      <ChatScreen
        shopId={screen.shopId}
        conversationId={screen.conversationId}
        shopInitial={screen.shopInitial}
        shopName={screen.shopName}
        shopLogoUrl={screen.shopLogoUrl}
        isVip={screen.isVip}
        paidTicketId={screen.paidTicketId}
        onBack={pop}
        onCheckout={order => push({ id: 'payment', order, from: 'chat' })}
      />
    );
  }

  // ── QR terrain ───────────────────────────────────────────────────────────
  if (screen.id === 'terrain_qr') {
    return (
      <TerrainQRScreen
        receiptCode={screen.receiptCode}
        terrainNom={screen.terrainNom}
        dateReservation={screen.dateReservation}
        heureDebut={screen.heureDebut}
        heureFin={screen.heureFin}
        prestataireName={screen.prestataireName}
        prixTotal={screen.prixTotal}
        onBack={() => setHistory([{ id: 'main' }])}
      />
    );
  }

  // ── Paiement terrain ──────────────────────────────────────────────────────
  if (screen.id === 'terrain_payment') {
    return (
      <TerrainPaymentScreen
        terrainId={screen.terrainId}
        terrainNom={screen.terrainNom}
        prestataireId={screen.prestataireId}
        prestataireName={screen.prestataireName}
        dateReservation={screen.dateReservation}
        heureDebut={screen.heureDebut}
        heureFin={screen.heureFin}
        dureeHeures={screen.dureeHeures}
        prixTotal={screen.prixTotal}
        onBack={pop}
        onSuccess={receiptCode =>
          push({
            id: 'terrain_qr',
            receiptCode,
            terrainNom: screen.terrainNom,
            dateReservation: screen.dateReservation,
            heureDebut: screen.heureDebut,
            heureFin: screen.heureFin,
            prestataireName: screen.prestataireName,
            prixTotal: screen.prixTotal,
          })
        }
      />
    );
  }

  // ── Mes réservations terrain ──────────────────────────────────────────────
  if (screen.id === 'terrain_my_reservations') {
    return <TerrainMyReservationsScreen onBack={pop} />;
  }

  // ── Liste découverte terrains ─────────────────────────────────────────────
  if (screen.id === 'terrain_list') {
    return (
      <TerrainsListScreen
        onBack={pop}
        onSelectTerrain={terrain => push({ id: 'terrain_detail', terrain })}
        initialSport={screen.sport}
      />
    );
  }

  if (screen.id === 'terrain_detail') {
    return <TerrainDetailScreen terrain={screen.terrain} onBack={pop} />;
  }

  // ── Réservation terrain ───────────────────────────────────────────────────
  if (screen.id === 'terrain_booking') {
    return (
      <TerrainBookingScreen
        terrain={screen.terrain}
        prestataireName={screen.prestataireName}
        onBack={pop}
        onBook={params =>
          push({
            id: 'terrain_payment',
            terrainId: params.terrainId,
            terrainNom: params.terrainNom,
            prestataireId: params.prestataireId,
            prestataireName: params.prestataireName,
            dateReservation: params.dateReservation,
            heureDebut: params.heureDebut,
            heureFin: params.heureFin,
            dureeHeures: params.dureeHeures,
            prixTotal: params.prixTotal,
          })
        }
      />
    );
  }

  // ── Vitrine prestataire ───────────────────────────────────────────────────
  if (screen.id === 'shop') {
    return (
      <ShopScreen
        shopId={screen.shopId}
        shopName={screen.shopName}
        targetProductId={screen.targetProductId}
        onBack={pop}
        onChat={(logoUrl, isVip) =>
          push({
            id: 'chat',
            shopId: screen.shopId,
            shopInitial: screen.shopName.charAt(0).toUpperCase(),
            shopName: screen.shopName,
            shopLogoUrl: logoUrl,
            isVip,
          })
        }
        onCheckout={() => push({ id: 'cart', shopId: screen.shopId, shopName: screen.shopName })}
        onBookTerrain={params =>
          push({
            id: 'terrain_booking',
            terrain: params.terrain,
            prestataireName: params.prestataireName,
          })
        }
        onBookTerrainDirect={params =>
          push({
            id: 'terrain_payment',
            terrainId: params.terrainId,
            terrainNom: params.terrainNom,
            prestataireId: params.prestataireId,
            prestataireName: params.prestataireName,
            dateReservation: params.dateReservation,
            heureDebut: params.heureDebut,
            heureFin: params.heureFin,
            dureeHeures: params.dureeHeures,
            prixTotal: params.prixTotal,
          })
        }
        onSuivi={params => push({ id: 'suivi_gps', ...params })}
      />
    );
  }

  // ── Catégorie ─────────────────────────────────────────────────────────────
  if (screen.id === 'category') {
    return (
      <CategoryScreen
        initialCatId={screen.catId}
        initialSubCatId={screen.subCatId}
        onBack={pop}
        onShopPress={pushShop}
        onCatStateChange={(catId, subCatId) =>
          setHistory(h => {
            const last = h[h.length - 1];
            if (last.id !== 'category' || (last.catId === catId && last.subCatId === subCatId)) {
              return h;
            }
            return [...h.slice(0, -1), { ...last, catId, subCatId }];
          })
        }
        onSearch={() => setHistory([{ id: 'main' }, { id: 'search' }])}
        onFavorites={() => setHistory([{ id: 'main' }, { id: 'favorites' }])}
        onMessages={() => setHistory([{ id: 'main' }, { id: 'messages' }])}
        onProfile={() => setHistory([{ id: 'main' }, { id: 'profile' }])}
        onVoice={() => setHistory([{ id: 'main' }, { id: 'voice' }])}
      />
    );
  }

  // ── Messages client ───────────────────────────────────────────────────────
  if (screen.id === 'messages') {
    return <ClientMessagesScreen onBack={pop} />;
  }

  // ── Favoris ───────────────────────────────────────────────────────────────
  if (screen.id === 'favorites') {
    return <FavoritesScreen onBack={pop} onShopPress={pushShop} />;
  }

  // ── Vus récemment ─────────────────────────────────────────────────────────
  if (screen.id === 'recent') {
    return <RecentlyViewedScreen onBack={pop} onShopPress={pushShop} />;
  }

  // ── Recherche ────────────────────────────────────────────────────────────
  if (screen.id === 'search') {
    return <SearchScreen onBack={pop} onShopPress={pushShop} />;
  }

  // ── Suivi GPS en app ─────────────────────────────────────────────────────
  if (screen.id === 'suivi_gps') {
    return (
      <SuiviGPSScreen
        shopLat={screen.shopLat}
        shopLng={screen.shopLng}
        shopName={screen.shopName}
        shopLogoUrl={screen.shopLogoUrl}
        onBack={pop}
      />
    );
  }

  // ── Carte ──────────────────────────────────────────────────────────────
  if (screen.id === 'map') {
    return (
      <MapScreen
        onBack={pop}
        onShopPress={pushShop}
        initialFilter={mapFilter}
        initialSearchQuery={mapSearch}
        onFilterChange={setMapFilter}
        onSearchChange={setMapSearch}
        onRouteSuivi={params =>
          push({ id: 'suivi_gps', ...params })
        }
      />
    );
  }

  // ── Notifications ────────────────────────────────────────────────────────
  if (screen.id === 'notifications') {
    return (
      <NotificationsScreen
        onBack={pop}
        onNavigate={(type, targetId) => {
          if (type === 'msg' && targetId) {
            // 1 tap → directement dans la bonne conversation
            // ChatScreen résoudra le vrai nom depuis Supabase via conversationId
            setHistory(h => [
              ...h.slice(0, -1), // retire l'écran notifications de l'historique
              {
                id: 'chat',
                conversationId: targetId,
                shopInitial: '?',
                shopName: '…',
                isVip: false,
              },
            ]);
          }
          // Les autres types (order, pay, vip) n'ont pas encore d'écran dédié côté client
        }}
      />
    );
  }

  // ── Assistant Lassi ───────────────────────────────────────────────────────
  if (screen.id === 'voice') {
    return <LassiAssistantScreen onClose={pop} onShopPress={pushShop} />;
  }

  // ── Mes commandes client ─────────────────────────────────────────────────────
  if (screen.id === 'orders') {
    return (
      <ClientOrdersScreen
        onBack={pop}
        onExplore={() => setHistory([{ id: 'main' }])}
        onGoToCart={(shopId, shopName) => push({ id: 'cart', shopId, shopName })}
        onViewReceipt={orderId => push({ id: 'receipt', orderId })}
      />
    );
  }

  // ── Reçu client ───────────────────────────────────────────────────────────────
  if (screen.id === 'receipt') {
    return <ReceiptScreen orderId={screen.orderId} onBack={pop} />;
  }

  // ── Classement ───────────────────────────────────────────────────────────
  if (screen.id === 'classement') {
    return <ClassementScreen variant="client" onBack={pop} />;
  }

  // ── Profil client ─────────────────────────────────────────────────────────
  if (screen.id === 'profile') {
    return (
      <ClientProfileScreen
        onBack={pop}
        onOrders={() => push({ id: 'orders' })}
        onFavorites={() => push({ id: 'favorites' })}
        onTerrainReservations={() => push({ id: 'terrain_my_reservations' })}
        onClassement={() => push({ id: 'classement' })}
        onLogout={onLogout}
      />
    );
  }

  // ── Accueil ───────────────────────────────────────────────────────────────
  return (
    <ClientHomeScreen
      onCategoryPress={(catId, title) => push({ id: 'category', catId, title })}
      onShopPress={pushShop}
      onShopItemPress={pushShopItem}
      onSearch={() => push({ id: 'search' })}
      onVoice={() => push({ id: 'voice' })}
      onFavorites={() => push({ id: 'favorites' })}
      onRecent={() => push({ id: 'recent' })}
      onMessages={() => push({ id: 'messages' })}
      onNotifications={() => push({ id: 'notifications' })}
      onProfile={() => push({ id: 'profile' })}
      onMap={() => push({ id: 'map' })}
      onTerrains={() => push({ id: 'terrain_list' })}
    />
  );
}
