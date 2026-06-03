import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { colors, fonts, TOP_INSET } from '../../theme';
import { IcoBack } from '../../components/icons';
import { Conversation } from '../../services/chat';
import * as chatService from '../../services/chat';
import ChatScreen  from '../chat/ChatScreen';
import useShopStore from '../../store/shopStore';
import Avatar        from '../../components/Avatar';
import MascoHomeBtn  from '../../components/MascoHomeBtn';

// ─── Icônes ──────────────────────────────────────────────────────────────────


// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeLabel(iso: string): string {
  const d   = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffH  = diffMs / 3_600_000;
  if (diffH < 24) return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
  if (diffH < 48) return 'Hier';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

// ─── Carte conversation ───────────────────────────────────────────────────────

interface ConvCardProps {
  conv:        Conversation;
  clientName:  string;
  clientAvatar: string | null;
  onPress:     () => void;
}

function ConvCard({ conv, clientName, clientAvatar, onPress }: ConvCardProps) {
  const unread = conv.merchantUnread;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      {/* Avatar client — Avatar unique, source de vérité profiles.avatar_url */}
      <Avatar
        imageUrl={clientAvatar}
        name={clientName || '?'}
        size={46}
        variant="user"
      />

      {/* Contenu */}
      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <Text style={styles.cardName} numberOfLines={1}>{clientName}</Text>
          <Text style={styles.cardTime}>{timeLabel(conv.lastMessageAt)}</Text>
        </View>
        <Text style={[styles.cardLast, unread > 0 && styles.cardLastUnread]} numberOfLines={1}>
          {conv.lastMessage ?? 'Nouvelle conversation'}
        </Text>
      </View>

      {/* Badge non-lus */}
      {unread > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeTxt}>{unread > 9 ? '9+' : unread}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Écran principal ──────────────────────────────────────────────────────────

interface Props {
  onBack: () => void;
}

interface OpenChat {
  conversationId: string;
  clientInitial:  string;
  clientName:     string;
  clientAvatar:   string | null;
}

export default function MerchantMessagesScreen({ onBack }: Props) {
  const shopId = useShopStore(s => s.shopId);

  const [conversations,  setConversations]  = useState<Conversation[]>([]);
  const [clientProfiles, setClientProfiles] = useState<Record<string, { name: string; avatarUrl: string | null }>>({});
  const [loading,        setLoading]        = useState(true);
  const [openChat,       setOpenChat]       = useState<OpenChat | null>(null);

  useEffect(() => {
    if (!shopId) { setLoading(false); return; }
    chatService.getMerchantConversations(shopId).then(async convs => {
      setConversations(convs);
      const profiles: Record<string, { name: string; avatarUrl: string | null }> = {};
      await Promise.all(convs.map(async c => {
        profiles[c.clientId] = await chatService.getClientProfile(c.clientId);
      }));
      setClientProfiles(profiles);
    }).finally(() => setLoading(false));
  }, [shopId]);

  if (openChat) {
    return (
      <ChatScreen
        conversationId={openChat.conversationId}
        shopInitial={openChat.clientInitial}
        shopName={openChat.clientName}
        shopLogoUrl={openChat.clientAvatar}
        onBack={() => setOpenChat(null)}
      />
    );
  }

  return (
    <View style={styles.root}>
      {/* Header */}
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
            Tes clients pourront t'écrire depuis ta vitrine LASSI.
          </Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={c => c.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const profile     = clientProfiles[item.clientId] ?? { name: '', avatarUrl: null };
            const name        = profile.name || 'Client';
            const initial     = name.charAt(0).toUpperCase();
            return (
              <ConvCard
                conv={item}
                clientName={name}
                clientAvatar={profile.avatarUrl}
                onPress={() => setOpenChat({
                  conversationId: item.id,
                  clientInitial:  initial,
                  clientName:     name,
                  clientAvatar:   profile.avatarUrl,
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
  backBtn: { width: 40, alignItems: 'center' },
  headerTitle: {
    color: colors.white,
    fontFamily: fonts.titleXL,
    fontSize: 17,
  },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyTitle: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 15,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyDesc: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },

  list: { paddingVertical: 8 },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 13,
    gap: 13,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cardBody: { flex: 1, minWidth: 0 },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardName: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 14,
    flex: 1,
  },
  cardTime: {
    color: colors.muted,
    fontFamily: fonts.ui,
    fontSize: 11,
    marginLeft: 8,
  },
  cardLast: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12.5,
  },
  cardLastUnread: {
    color: colors.white,
    fontFamily: fonts.title,
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    flexShrink: 0,
  },
  badgeTxt: {
    color: colors.bg,
    fontFamily: fonts.titleXL,
    fontSize: 10,
  },
});
