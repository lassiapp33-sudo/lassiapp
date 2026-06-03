import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { colors, fonts, TOP_INSET } from '../../theme';
import { IcoBack } from '../../components/icons';
import { Conversation } from '../../services/chat';
import * as chatService  from '../../services/chat';
import * as shopsService from '../../services/shops';
import { Shop }          from '../../services/shops';
import ChatScreen        from '../chat/ChatScreen';
import Avatar            from '../../components/Avatar';
import MascoHomeBtn      from '../../components/MascoHomeBtn';


function timeLabel(iso: string): string {
  const d      = new Date(iso);
  const diffH  = (Date.now() - d.getTime()) / 3_600_000;
  if (diffH < 24) return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  if (diffH < 48) return 'Hier';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

interface ConvCardProps {
  conv:     Conversation;
  shop:     Shop | undefined;
  onPress:  () => void;
}

function ConvCard({ conv, shop, onPress }: ConvCardProps) {
  const unread = conv.clientUnread;
  const name   = shop?.name ?? 'Boutique';

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      {/* Logo boutique — Avatar unique, source de vérité shops.logo_url */}
      <Avatar
        imageUrl={shop?.logoUrl}
        name={name}
        size={46}
        variant="shop"
      />

      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <Text style={styles.cardName} numberOfLines={1}>{name}</Text>
          <Text style={styles.cardTime}>{timeLabel(conv.lastMessageAt)}</Text>
        </View>
        <Text style={[styles.cardLast, unread > 0 && styles.cardLastUnread]} numberOfLines={1}>
          {conv.lastMessage ?? 'Nouvelle conversation'}
        </Text>
      </View>

      {unread > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeTxt}>{unread > 9 ? '9+' : unread}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

interface Props {
  onBack: () => void;
}

interface OpenChat {
  conversationId: string;
  shopId:         string;
  shopName:       string;
  shopInitial:    string;
  shopLogoUrl?:   string | null;
}

export default function ClientMessagesScreen({ onBack }: Props) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [shops,         setShops]         = useState<Record<string, Shop>>({});
  const [loading,       setLoading]       = useState(true);
  const [openChat,      setOpenChat]      = useState<OpenChat | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const convs = await chatService.getMyConversations();
        setConversations(convs);

        // Charger les infos boutique pour chaque conversation
        const shopMap: Record<string, Shop> = {};
        await Promise.all(convs.map(async c => {
          try {
            const s = await shopsService.getShopById(c.shopId);
            if (s) shopMap[c.shopId] = s;
          } catch {}
        }));
        setShops(shopMap);
      } catch {}
      finally { setLoading(false); }
    };
    load();
  }, []);

  if (openChat) {
    return (
      <ChatScreen
        conversationId={openChat.conversationId}
        shopId={openChat.shopId}
        shopInitial={openChat.shopInitial}
        shopName={openChat.shopName}
        shopLogoUrl={openChat.shopLogoUrl}
        onBack={() => setOpenChat(null)}
      />
    );
  }

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: TOP_INSET + 10 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
          <IcoBack />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Messages</Text>
        <MascoHomeBtn />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      ) : conversations.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>Aucun message pour l'instant</Text>
          <Text style={styles.emptyDesc}>
            Tes échanges avec les boutiques LASSI apparaîtront ici.
          </Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={c => c.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const shop = shops[item.shopId];
            return (
              <ConvCard
                conv={item}
                shop={shop}
                onPress={() => setOpenChat({
                  conversationId: item.id,
                  shopId:         item.shopId,
                  shopName:       shop?.name ?? 'Boutique',
                  shopInitial:    shop?.name.charAt(0).toUpperCase() ?? 'B',
                  shopLogoUrl:    shop?.logoUrl ?? null,
                })}
              />
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn:     { width: 40, alignItems: 'center' },
  headerTitle: { color: colors.white, fontFamily: fonts.titleXL, fontSize: 17 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyTitle: {
    color: colors.white, fontFamily: fonts.title,
    fontSize: 15, marginBottom: 8, textAlign: 'center',
  },
  emptyDesc: {
    color: colors.muted, fontFamily: fonts.body,
    fontSize: 13, textAlign: 'center', lineHeight: 20,
  },

  list: { paddingVertical: 8 },

  card: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 18, paddingVertical: 13, gap: 13,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  cardBody:  { flex: 1, minWidth: 0 },
  cardTop: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 4,
  },
  cardName:       { color: colors.white, fontFamily: fonts.title, fontSize: 14, flex: 1 },
  cardTime:       { color: colors.muted, fontFamily: fonts.ui, fontSize: 11, marginLeft: 8 },
  cardLast:       { color: colors.muted, fontFamily: fonts.body, fontSize: 12.5 },
  cardLastUnread: { color: colors.white, fontFamily: fonts.title },
  badge: {
    minWidth: 20, height: 20, borderRadius: 10,
    backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5, flexShrink: 0,
  },
  badgeTxt: { color: colors.bg, fontFamily: fonts.titleXL, fontSize: 10 },
});
