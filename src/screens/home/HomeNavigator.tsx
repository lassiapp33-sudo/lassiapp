import React, { useState } from 'react';
import ClientHomeScreen     from './ClientHomeScreen';
import ClientProfileScreen  from './ClientProfileScreen';
import VoiceAssistantScreen from './VoiceAssistantScreen';
import SearchScreen         from './SearchScreen';
import NotificationsScreen  from './NotificationsScreen';
import FavoritesScreen      from './FavoritesScreen';
import CartScreen           from './CartScreen';
import CategoryScreen       from '../category/CategoryScreen';
import ShopScreen           from '../shop/ShopScreen';
import ChatScreen           from '../chat/ChatScreen';
import PaymentScreen        from '../payment/PaymentScreen';
import { CatId }            from '../../components/category/CatNavBar';
import { OrderInfo }        from '../../types/payment';

// ─── Stack de navigation client ───────────────────────────────────────────────

type HomeStack =
  | { id: 'main' }
  | { id: 'profile' }
  | { id: 'voice' }
  | { id: 'search' }
  | { id: 'notifications' }
  | { id: 'favorites' }
  | { id: 'cart';     shopId: string; shopName: string }
  | { id: 'category'; catId: CatId;   title: string }
  | { id: 'shop';     shopId: string; shopName: string }
  | { id: 'chat';     shopInitial: string; shopName: string; isVip: boolean; paidTicketId?: string }
  | { id: 'payment';  order: OrderInfo; from: 'chat' | 'shop' | 'cart'; shopId?: string; shopName?: string };

interface Props {
  onLogout: () => void;
}

export default function HomeNavigator({ onLogout }: Props) {
  const [stack, setStack] = useState<HomeStack>({ id: 'main' });

  // ── Paiement ──────────────────────────────────────────────────────────────
  if (stack.id === 'payment') {
    return (
      <PaymentScreen
        order={stack.order}
        onBack={() => {
          if (stack.from === 'chat') {
            setStack({ id: 'chat', shopInitial: stack.order.shopInitial, shopName: stack.order.shopName, isVip: true });
          } else if (stack.from === 'cart') {
            setStack({ id: 'cart', shopId: stack.shopId ?? '', shopName: stack.shopName ?? stack.order.shopName });
          } else {
            setStack({ id: 'shop', shopId: stack.shopId ?? '', shopName: stack.order.shopName });
          }
        }}
        onSuccess={(ticketId) => {
          if (stack.from === 'chat') {
            setStack({ id: 'chat', shopInitial: stack.order.shopInitial, shopName: stack.order.shopName, isVip: true, paidTicketId: ticketId });
          } else {
            setStack({ id: 'main' });
          }
        }}
      />
    );
  }

  // ── Panier — lit cartStore directement ───────────────────────────────────
  if (stack.id === 'cart') {
    return (
      <CartScreen
        shopId={stack.shopId}
        shopName={stack.shopName}
        onBack={() => setStack({ id: 'shop', shopId: stack.shopId, shopName: stack.shopName })}
        onCheckout={(order) =>
          setStack({ id: 'payment', order, from: 'cart', shopId: stack.shopId, shopName: stack.shopName })
        }
      />
    );
  }

  // ── Chat ─────────────────────────────────────────────────────────────────
  if (stack.id === 'chat') {
    return (
      <ChatScreen
        shopInitial={stack.shopInitial}
        shopName={stack.shopName}
        isVip={stack.isVip}
        paidTicketId={stack.paidTicketId}
        onBack={() => setStack({ id: 'main' })}
        onCheckout={(order) =>
          setStack({ id: 'payment', order, from: 'chat' })
        }
      />
    );
  }

  // ── Vitrine commerçant ────────────────────────────────────────────────────
  if (stack.id === 'shop') {
    return (
      <ShopScreen
        shopId={stack.shopId}
        onBack={() => setStack({ id: 'main' })}
        onChat={() => setStack({ id: 'chat', shopInitial: 'D', shopName: stack.shopName, isVip: true })}
        onCheckout={() =>
          setStack({ id: 'cart', shopId: stack.shopId, shopName: stack.shopName })
        }
      />
    );
  }

  // ── Catégorie ─────────────────────────────────────────────────────────────
  if (stack.id === 'category') {
    return (
      <CategoryScreen
        initialCatId={stack.catId}
        onBack={() => setStack({ id: 'main' })}
        onShopPress={(shopId, shopName) =>
          setStack({ id: 'shop', shopId, shopName })
        }
      />
    );
  }

  // ── Favoris ───────────────────────────────────────────────────────────────
  if (stack.id === 'favorites') {
    return (
      <FavoritesScreen
        onBack={() => setStack({ id: 'main' })}
        onShopPress={(shopId, shopName) =>
          setStack({ id: 'shop', shopId, shopName })
        }
      />
    );
  }

  // ── Recherche ────────────────────────────────────────────────────────────
  if (stack.id === 'search') {
    return (
      <SearchScreen
        onBack={() => setStack({ id: 'main' })}
        onShopPress={(shopId, shopName) =>
          setStack({ id: 'shop', shopId, shopName })
        }
      />
    );
  }

  // ── Notifications ────────────────────────────────────────────────────────
  if (stack.id === 'notifications') {
    return (
      <NotificationsScreen
        onBack={() => setStack({ id: 'main' })}
      />
    );
  }

  // ── Assistant Vocal IA ────────────────────────────────────────────────────
  if (stack.id === 'voice') {
    return (
      <VoiceAssistantScreen
        onClose={() => setStack({ id: 'main' })}
      />
    );
  }

  // ── Profil client ─────────────────────────────────────────────────────────
  if (stack.id === 'profile') {
    return (
      <ClientProfileScreen
        onFavorites={() => setStack({ id: 'favorites' })}
        onLogout={onLogout}
      />
    );
  }

  // ── Accueil ───────────────────────────────────────────────────────────────
  return (
    <ClientHomeScreen
      onCategoryPress={(catId, title) =>
        setStack({ id: 'category', catId, title })
      }
      onShopPress={(shopId, shopName) =>
        setStack({ id: 'shop', shopId, shopName })
      }
      onSearch={() => setStack({ id: 'search' })}
      onVoice={() => setStack({ id: 'voice' })}
      onFavorites={() => setStack({ id: 'favorites' })}
      onNotifications={() => setStack({ id: 'notifications' })}
      onProfile={() => setStack({ id: 'profile' })}
    />
  );
}
