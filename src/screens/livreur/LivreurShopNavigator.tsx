import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, fonts } from '../../theme';
import ClientHomeScreen from '../home/ClientHomeScreen';
import ShopScreen from '../shop/ShopScreen';
import CartScreen from '../home/CartScreen';
import PaymentScreen from '../payment/PaymentScreen';
import ClientOrdersScreen from '../home/ClientOrdersScreen';
import ReceiptScreen from '../home/ReceiptScreen';
import SearchScreen from '../home/SearchScreen';
import CategoryScreen from '../category/CategoryScreen';
import ChatScreen from '../chat/ChatScreen';
import { CatId } from '../../components/category/CatNavBar';
import { OrderInfo } from '../../types/payment';
import { recordView, recordCarouselClick, recordCarouselVue } from '../../services/recentlyViewed';
import logger from '../../utils/logger';

type Stack =
  | { id: 'main' }
  | { id: 'search' }
  | { id: 'orders' }
  | { id: 'receipt'; orderId: string }
  | { id: 'category'; catId: CatId; title: string; subCatId?: string }
  | { id: 'shop'; shopId: string; shopName: string; targetProductId?: string }
  | { id: 'cart'; shopId: string; shopName: string }
  | { id: 'payment'; order: OrderInfo; from: 'chat' | 'shop' | 'cart'; shopId?: string; shopName?: string }
  | {
      id: 'chat';
      shopId?: string;
      conversationId?: string;
      shopInitial: string;
      shopName: string;
      shopLogoUrl?: string | null;
      isVip: boolean;
      paidTicketId?: string;
    };

interface Props {
  onBack: () => void;
}

export default function LivreurShopNavigator({ onBack }: Props) {
  const [history, setHistory] = useState<Stack[]>([{ id: 'main' }]);
  const screen = history[history.length - 1];
  const push = (s: Stack) => setHistory(h => [...h, s]);
  const pop = () => setHistory(h => h.length > 1 ? h.slice(0, -1) : h);

  const pushShop = (shopId: string, shopName: string) => {
    recordView(shopId).catch(err => logger.warn('[LivreurShopNavigator] recordView:', err));
    push({ id: 'shop', shopId, shopName });
  };

  const pushShopItem = (shopId: string, shopName: string, productId: string) => {
    recordView(shopId).catch(() => {});
    recordCarouselClick(shopId, productId).catch(() => {});
    push({ id: 'shop', shopId, shopName, targetProductId: productId });
  };

  const onShopItemView = (shopId: string, productId: string) => {
    recordCarouselVue(shopId, productId).catch(() => {});
  };

  if (screen.id === 'payment') {
    return (
      <PaymentScreen
        order={screen.order}
        onBack={pop}
        onSuccess={() => setHistory([{ id: 'main' }, { id: 'orders' }])}
      />
    );
  }

  if (screen.id === 'cart') {
    return (
      <CartScreen
        shopId={screen.shopId}
        shopName={screen.shopName}
        onBack={pop}
        onCheckout={order =>
          push({ id: 'payment', order, from: 'cart', shopId: screen.shopId, shopName: screen.shopName })
        }
      />
    );
  }

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
        onBookTerrain={() => {}}
        onBookTerrainDirect={() => {}}
        onSuivi={() => {}}
        onFitnessAboPayment={() => {}}
      />
    );
  }

  if (screen.id === 'category') {
    return (
      <CategoryScreen
        initialCatId={screen.catId}
        initialSubCatId={screen.subCatId}
        onBack={pop}
        onShopPress={pushShop}
        onBlocPress={() => {}}
        onCatStateChange={(catId, subCatId) =>
          setHistory(h => {
            const last = h[h.length - 1];
            if (last.id !== 'category') return h;
            return [...h.slice(0, -1), { ...last, catId, subCatId }];
          })
        }
        onSearch={() => setHistory([{ id: 'main' }, { id: 'search' }])}
        onFavorites={() => {}}
        onMessages={() => {}}
        onProfile={() => {}}
        onVoice={() => {}}
      />
    );
  }

  if (screen.id === 'search') {
    return <SearchScreen onBack={pop} onShopPress={pushShop} />;
  }

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

  if (screen.id === 'receipt') {
    return <ReceiptScreen orderId={screen.orderId} onBack={pop} />;
  }

  // Écran principal — boutiques LASSI
  return (
    <View style={s.root}>
      <ClientHomeScreen
        onCategoryPress={(catId, title) => push({ id: 'category', catId, title })}
        onShopPress={pushShop}
        onShopItemPress={pushShopItem}
        onShopItemView={onShopItemView}
        onSearch={() => push({ id: 'search' })}
        onVoice={() => {}}
        onClassement={() => {}}
        onAlaUneFeed={() => {}}
        onFavorites={() => {}}
        onRecent={() => {}}
        onMessages={() => {}}
        onNotifications={() => {}}
        onProfile={() => push({ id: 'orders' })}
        onMap={() => {}}
        onTerrains={() => {}}
        onContactShop={(shopId, shopName, shopLogoUrl) =>
          push({
            id: 'chat',
            shopId,
            shopInitial: shopName.charAt(0).toUpperCase(),
            shopName,
            shopLogoUrl,
            isVip: false,
          })
        }
      />
      <TouchableOpacity style={s.backStrip} onPress={onBack} activeOpacity={0.85}>
        <Text style={s.backTxt}>← Retour espace livreur</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  backStrip: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingVertical: 13,
    alignItems: 'center',
  },
  backTxt: {
    color: colors.accent,
    fontFamily: fonts.ui,
    fontSize: 14,
  },
});
