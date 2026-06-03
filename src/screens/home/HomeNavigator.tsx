import React, { useState, useEffect } from 'react';
import ClientHomeScreen      from './ClientHomeScreen';
import ClientProfileScreen   from './ClientProfileScreen';
import ClientOrdersScreen    from './ClientOrdersScreen';
import ClientMessagesScreen  from './ClientMessagesScreen';
import LassiAssistantScreen  from './LassiAssistantScreen';
import SearchScreen          from './SearchScreen';
import NotificationsScreen   from './NotificationsScreen';
import FavoritesScreen       from './FavoritesScreen';
import RecentlyViewedScreen  from './RecentlyViewedScreen';
import CartScreen            from './CartScreen';
import MapScreen             from './MapScreen';
import ReceiptScreen         from './ReceiptScreen';
import CategoryScreen        from '../category/CategoryScreen';
import ShopScreen            from '../shop/ShopScreen';
import ChatScreen            from '../chat/ChatScreen';
import PaymentScreen         from '../payment/PaymentScreen';
import { CatId }             from '../../components/category/CatNavBar';
import { OrderInfo }         from '../../types/payment';
import useAuthStore               from '../../store/authStore';
import useNotificationsStore      from '../../store/notificationsStore';
import usePendingNavStore         from '../../store/pendingNavStore';
import { useRealtimeNotifications } from '../../hooks/useRealtimeNotifications';
import { recordView }        from '../../services/recentlyViewed';

// ─── Stack de navigation client ───────────────────────────────────────────────

type HomeStack =
  | { id: 'main' }
  | { id: 'profile' }
  | { id: 'orders' }
  | { id: 'voice' }
  | { id: 'search' }
  | { id: 'notifications' }
  | { id: 'favorites' }
  | { id: 'recent' }
  | { id: 'messages' }
  | { id: 'map' }
  | { id: 'cart';     shopId: string; shopName: string }
  | { id: 'category'; catId: CatId;   title: string }
  | { id: 'shop';     shopId: string; shopName: string }
  | { id: 'chat';     shopId?: string; conversationId?: string; shopInitial: string; shopName: string; shopLogoUrl?: string | null; isVip: boolean; paidTicketId?: string }
  | { id: 'payment';  order: OrderInfo; from: 'chat' | 'shop' | 'cart'; shopId?: string; shopName?: string }
  | { id: 'receipt';  orderId: string };

interface Props {
  onLogout: () => void;
}

export default function HomeNavigator({ onLogout }: Props) {
  const [history, setHistory] = useState<HomeStack[]>([{ id: 'main' }]);

  const screen = history[history.length - 1];
  const push   = (s: HomeStack) => setHistory(h => [...h, s]);
  const pop    = () => setHistory(h => h.length > 1 ? h.slice(0, -1) : h);

  // Enregistre la visite dans recently_viewed puis navigue vers la vitrine
  const pushShop = (shopId: string, shopName: string) => {
    recordView(shopId).catch(console.warn);
    push({ id: 'shop', shopId, shopName });
  };

  // Abonnement Realtime toujours actif — met à jour le badge cloche en temps réel
  const userId       = useAuthStore(s => s.user?.id ?? null);
  const addNotif     = useNotificationsStore(s => s.addNotif);
  const pendingNav   = usePendingNavStore(s => s.pendingNav);
  const clearPending = usePendingNavStore(s => s.clearPendingNav);
  useRealtimeNotifications(userId, addNotif);

  // Deep link depuis notification push (app fermée / arrière-plan)
  useEffect(() => {
    if (!pendingNav) return;
    clearPending();
    if (pendingNav.type === 'home') {
      setHistory([{ id: 'main' }]);
    } else if (pendingNav.type === 'msg') {
      setHistory([{ id: 'main' }, {
        id:           'chat',
        conversationId: pendingNav.conversationId,
        shopInitial:  '?',
        shopName:     '…',
        isVip:        false,
      }]);
    } else if (pendingNav.type === 'order') {
      setHistory([{ id: 'main' }, { id: 'orders' }]);
    }
  }, [pendingNav]);

  // ── Paiement ──────────────────────────────────────────────────────────────
  if (screen.id === 'payment') {
    return (
      <PaymentScreen
        order={screen.order}
        onBack={pop}
        onSuccess={(ticketId) => {
          if (screen.from === 'chat') {
            setHistory([{ id: 'main' }, {
              id: 'chat',
              shopId:       screen.shopId ?? '',
              shopInitial:  screen.order.shopInitial,
              shopName:     screen.order.shopName,
              isVip:        false,
              paidTicketId: ticketId,
            }]);
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
        onCheckout={(order) =>
          push({ id: 'payment', order, from: 'cart', shopId: screen.shopId, shopName: screen.shopName })
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
        onCheckout={(order) =>
          push({ id: 'payment', order, from: 'chat' })
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
        onBack={pop}
        onChat={(logoUrl, isVip) => push({
          id:          'chat',
          shopId:      screen.shopId,
          shopInitial: screen.shopName.charAt(0).toUpperCase(),
          shopName:    screen.shopName,
          shopLogoUrl: logoUrl,
          isVip,
        })}
        onCheckout={() =>
          push({ id: 'cart', shopId: screen.shopId, shopName: screen.shopName })
        }
      />
    );
  }

  // ── Catégorie ─────────────────────────────────────────────────────────────
  if (screen.id === 'category') {
    return (
      <CategoryScreen
        initialCatId={screen.catId}
        onBack={pop}
        onShopPress={pushShop}
        onSearch={()    => setHistory([{ id: 'main' }, { id: 'search' }])}
        onFavorites={()  => setHistory([{ id: 'main' }, { id: 'favorites' }])}
        onMessages={()   => setHistory([{ id: 'main' }, { id: 'messages' }])}
        onProfile={()    => setHistory([{ id: 'main' }, { id: 'profile' }])}
        onVoice={()      => setHistory([{ id: 'main' }, { id: 'voice' }])}
      />
    );
  }

  // ── Messages client ───────────────────────────────────────────────────────
  if (screen.id === 'messages') {
    return <ClientMessagesScreen onBack={pop} />;
  }

  // ── Favoris ───────────────────────────────────────────────────────────────
  if (screen.id === 'favorites') {
    return (
      <FavoritesScreen
        onBack={pop}
        onShopPress={pushShop}
      />
    );
  }

  // ── Vus récemment ─────────────────────────────────────────────────────────
  if (screen.id === 'recent') {
    return (
      <RecentlyViewedScreen
        onBack={pop}
        onShopPress={pushShop}
      />
    );
  }

  // ── Recherche ────────────────────────────────────────────────────────────
  if (screen.id === 'search') {
    return (
      <SearchScreen
        onBack={pop}
        onShopPress={pushShop}
      />
    );
  }

  // ── Carte ──────────────────────────────────────────────────────────────
  if (screen.id === 'map') {
    return (
      <MapScreen
        onBack={pop}
        onShopPress={pushShop}
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
              ...h.slice(0, -1),  // retire l'écran notifications de l'historique
              { id: 'chat', conversationId: targetId, shopInitial: '?', shopName: '…', isVip: false },
            ]);
          }
          // Les autres types (order, pay, vip) n'ont pas encore d'écran dédié côté client
        }}
      />
    );
  }

  // ── Assistant Lassi ───────────────────────────────────────────────────────
  if (screen.id === 'voice') {
    return (
      <LassiAssistantScreen
        onClose={pop}
        onShopPress={pushShop}
      />
    );
  }

  // ── Mes commandes client ─────────────────────────────────────────────────────
  if (screen.id === 'orders') {
    return (
      <ClientOrdersScreen
        onBack={pop}
        onExplore={() => setHistory([{ id: 'main' }])}
        onGoToCart={(shopId, shopName) => push({ id: 'cart', shopId, shopName })}
        onViewReceipt={(orderId) => push({ id: 'receipt', orderId })}
      />
    );
  }

  // ── Reçu client ───────────────────────────────────────────────────────────────
  if (screen.id === 'receipt') {
    return <ReceiptScreen orderId={screen.orderId} onBack={pop} />;
  }

  // ── Profil client ─────────────────────────────────────────────────────────
  if (screen.id === 'profile') {
    return (
      <ClientProfileScreen
        onBack={pop}
        onOrders={() => push({ id: 'orders' })}
        onFavorites={() => push({ id: 'favorites' })}
        onLogout={onLogout}
      />
    );
  }

  // ── Accueil ───────────────────────────────────────────────────────────────
  return (
    <ClientHomeScreen
      onCategoryPress={(catId, title) =>
        push({ id: 'category', catId, title })
      }
      onShopPress={pushShop}
      onSearch={() => push({ id: 'search' })}
      onVoice={() => push({ id: 'voice' })}
      onFavorites={() => push({ id: 'favorites' })}
      onRecent={() => push({ id: 'recent' })}
      onMessages={() => push({ id: 'messages' })}
      onNotifications={() => push({ id: 'notifications' })}
      onProfile={() => push({ id: 'profile' })}
      onMap={() => push({ id: 'map' })}
    />
  );
}
