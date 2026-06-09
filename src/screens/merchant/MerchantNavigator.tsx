import React, { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import MerchantDashboard from './MerchantDashboard';
import MerchantProfileScreen from './MerchantProfileScreen';
import MerchantMessagesScreen from './MerchantMessagesScreen';
import MerchantPaymentsScreen from './MerchantPaymentsScreen';
import MerchantAvisScreen from './MerchantAvisScreen';
import DebtsScreen from './DebtsScreen';
import StoreScreen from './StoreScreen';
import OrdersScreen from './OrdersScreen';
import VisibilityScreen from './VisibilityScreen';
import RevenueScreen from './RevenueScreen';
import PromotionsScreen from './PromotionsScreen';
import TerrainScreen from './TerrainScreen';
import TerrainEditScreen from './TerrainEditScreen';
import TerrainReservationsScreen from './TerrainReservationsScreen';
import TerrainScanScreen from './TerrainScanScreen';
import { Terrain } from '../../types/terrain';
import NotificationsScreen from '../home/NotificationsScreen';
import ChatScreen from '../chat/ChatScreen';
import ShopScreen from '../shop/ShopScreen';
import MapScreen from '../home/MapScreen';
import CartScreen from '../home/CartScreen';
import PaymentScreen from '../payment/PaymentScreen';
import ClientOrdersScreen from '../home/ClientOrdersScreen';
import LassiAssistantScreen from '../home/LassiAssistantScreen';
import useShopStore from '../../store/shopStore';
import useAuthStore from '../../store/authStore';
import useNotificationsStore from '../../store/notificationsStore';
import usePendingNavStore from '../../store/pendingNavStore';
import { useRealtimeNotifications } from '../../hooks/useRealtimeNotifications';
import { OrderInfo } from '../../types/payment';

// Navigateur du cockpit prestataire — tous les modules sont câblés ici.
type MerchantScreen =
  | 'dashboard'
  | 'debts'
  | 'store'
  | 'orders'
  | 'messages'
  | 'visibility'
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
  | 'terrain_scan';

interface Props {
  onLogout: () => void;
}

export default function MerchantNavigator({ onLogout }: Props) {
  const [screen, setScreen] = useState<MerchantScreen>('dashboard');
  const shopId = useShopStore(s => s.shopId);

  // Persiste le filtre/recherche de la carte entre navigations
  const [mapFilter, setMapFilter] = useState('all');
  const [mapSearch, setMapSearch] = useState('');
  const userId = useAuthStore(s => s.user?.id ?? null);
  const addNotif = useNotificationsStore(s => s.addNotif);

  const pendingNav = usePendingNavStore(s => s.pendingNav);
  const clearPending = usePendingNavStore(s => s.clearPendingNav);

  // Abonnement Realtime toujours actif — met à jour le badge immédiatement
  useRealtimeNotifications(userId, addNotif);

  // Deep link depuis notification push ou retour paiement
  useEffect(() => {
    if (!pendingNav) return;
    clearPending();
    if (pendingNav.type === 'home') {
      setScreen('dashboard');
    } else if (pendingNav.type === 'msg') {
      setScreen({ id: 'chat', conversationId: pendingNav.conversationId });
    } else if (pendingNav.type === 'order') {
      setScreen('orders');
    } else if (pendingNav.type === 'payment_success') {
      setScreen('orders');
    } else if (pendingNav.type === 'payment_failed') {
      Alert.alert('Paiement échoué', 'Le paiement n\'a pas pu être confirmé. Réessayez ou choisissez un autre moyen de paiement.');
      setScreen('payments');
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
        onNavigate={(type, targetId) => {
          if (type === 'msg' && targetId) {
            // 1 tap → directement dans la bonne conversation
            setScreen({ id: 'chat', conversationId: targetId });
            return;
          }
          if (type === 'order' || type === 'pay') setScreen('orders');
          if (type === 'vip') setScreen('messages');
        }}
      />
    );
  if (screen === 'terrain_scan')
    return <TerrainScanScreen onBack={() => setScreen('terrains')} />;

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
      <TerrainReservationsScreen
        terrain={screen.terrain}
        onBack={() => setScreen('terrains')}
      />
    );

  if (screen === 'terrains')
    return (
      <TerrainScreen
        onBack={() => setScreen('dashboard')}
        onAddTerrain={() => setScreen({ id: 'terrain_edit' })}
        onEditTerrain={t => setScreen({ id: 'terrain_edit', terrain: t })}
        onTerrainReservations={t => setScreen({ id: 'terrain_reservations', terrain: t })}
      />
    );

  if (screen === 'preview')
    return <ShopScreen shopId={shopId ?? ''} onBack={() => setScreen('store')} />;
  if (screen === 'avis') return <MerchantAvisScreen onBack={() => setScreen('dashboard')} />;
  if (screen === 'debts') return <DebtsScreen onBack={() => setScreen('dashboard')} />;
  if (screen === 'promotions') return <PromotionsScreen onBack={() => setScreen('store')} />;
  if (screen === 'store')
    return (
      <StoreScreen
        onBack={() => setScreen('dashboard')}
        onPreview={() => setScreen('preview')}
        onPromos={() => setScreen('promotions')}
      />
    );
  if (screen === 'orders') return <OrdersScreen onBack={() => setScreen('dashboard')} />;
  if (screen === 'messages')
    return <MerchantMessagesScreen onBack={() => setScreen('dashboard')} />;
  if (screen === 'visibility') return <VisibilityScreen onBack={() => setScreen('dashboard')} />;
  if (screen === 'revenue') return <RevenueScreen onBack={() => setScreen('profile')} />;
  if (screen === 'payments') return <MerchantPaymentsScreen onBack={() => setScreen('profile')} />;
  if (screen === 'profile')
    return (
      <MerchantProfileScreen
        onBack={() => setScreen('dashboard')}
        onStore={() => setScreen('store')}
        onVisibility={() => setScreen('visibility')}
        onRevenue={() => setScreen('revenue')}
        onPayments={() => setScreen('payments')}
        onMyOrders={() => setScreen('myorders')}
        onLogout={onLogout}
      />
    );

  return (
    <MerchantDashboard
      onNavigate={dest => {
        if (dest === 'debts') setScreen('debts');
        if (dest === 'store') setScreen('store');
        if (dest === 'orders') setScreen('orders');
        if (dest === 'messages') setScreen('messages');
        if (dest === 'visibility') setScreen('visibility');
        if (dest === 'profile') setScreen('profile');
        if (dest === 'notifications') setScreen('notifications');
        if (dest === 'assistant') setScreen('assistant');
        if (dest === 'aroundme') setScreen('aroundme');
        if (dest === 'avis') setScreen('avis');
        if (dest === 'terrains') setScreen('terrains');
      }}
      onNotifPress={() => setScreen('notifications')}
    />
  );
}
