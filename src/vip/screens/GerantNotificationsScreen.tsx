import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { royal as r } from '../theme';
import { VIP_FONTS } from '../useVipFonts';
import { TOP_INSET } from '../../theme';
import { supabase } from '../../lib/supabase';

interface Notif {
  id: string;
  type: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
}

function timeLabel(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "à l'instant";
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
  const d = Math.floor(diff / 86400);
  return `il y a ${d} jour${d > 1 ? 's' : ''}`;
}

const IcoBack = () => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none"
    stroke={r.couleur.or} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M15 18l-6-6 6-6" />
  </Svg>
);

interface Props {
  onBack: () => void;
  onNavigate?: (type: string) => void;
}

export default function GerantNotificationsScreen({ onBack, onNavigate }: Props) {
  const [notifs, setNotifs]       = useState<Notif[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const since48h = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from('notifications')
        .select('id, type, title, body, is_read, created_at')
        .eq('user_id', user.id)
        .gte('created_at', since48h)
        .order('created_at', { ascending: false })
        .limit(50);
      setNotifs(data ?? []);
      // Tout marquer comme lu
      if (data && data.some((n: Notif) => !n.is_read)) {
        await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id);
      }
    } catch { /* silencieux */ } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <View style={s.fond}>
      <StatusBar barStyle="light-content" />
      <View style={[s.header, { paddingTop: TOP_INSET + 12 }]}>
        <TouchableOpacity onPress={onBack} hitSlop={12} style={s.backBtn}>
          <IcoBack />
        </TouchableOpacity>
        <Text style={s.headerTitre}>Notifications</Text>
        <View style={{ width: 32 }} />
      </View>

      {loading ? (
        <View style={s.centre}>
          <ActivityIndicator color={r.couleur.or} />
        </View>
      ) : (
        <ScrollView
          style={s.scroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
              tintColor={r.couleur.or}
            />
          }
        >
          {notifs.length === 0 ? (
            <View style={s.emptyBox}>
              <Text style={s.emptyTxt}>Aucune notification récente</Text>
            </View>
          ) : notifs.map(n => (
            <TouchableOpacity
              key={n.id}
              style={[s.card, !n.is_read && s.cardUnread]}
              onPress={() => onNavigate?.(n.type)}
              activeOpacity={onNavigate ? 0.75 : 1}
            >
              <View style={s.cardHeader}>
                <Text style={s.cardTitle} numberOfLines={1}>{n.title}</Text>
                <Text style={s.cardTime}>{timeLabel(n.created_at)}</Text>
              </View>
              <Text style={s.cardBody}>{n.body}</Text>
            </TouchableOpacity>
          ))}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  fond:   { flex: 1, backgroundColor: r.couleur.encre },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: r.espace.md,
    paddingBottom: r.espace.md,
    borderBottomWidth: 1,
    borderBottomColor: r.couleur.filetFin,
  },
  backBtn: { width: 32, alignItems: 'flex-start' },
  headerTitre: {
    flex: 1,
    fontFamily: VIP_FONTS.palais.titre,
    fontSize: 18,
    color: r.couleur.ivoire,
    letterSpacing: 1.5,
    textAlign: 'center',
  },

  emptyBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  emptyTxt: {
    fontFamily: VIP_FONTS.palais.util,
    fontSize: 13,
    color: r.couleur.gris,
    textAlign: 'center',
  },

  card: {
    marginHorizontal: r.espace.md,
    marginTop: r.espace.sm,
    padding: 14,
    borderWidth: 1,
    borderColor: r.couleur.filetFin,
    backgroundColor: r.couleur.velours,
    gap: 6,
  },
  cardUnread: {
    borderColor: r.couleur.or,
    backgroundColor: `${r.couleur.orLassi}0D`,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  cardTitle: {
    flex: 1,
    fontFamily: VIP_FONTS.palais.util,
    fontSize: 13,
    color: r.couleur.ivoire,
    letterSpacing: 0.3,
  },
  cardTime: {
    fontFamily: VIP_FONTS.palais.util,
    fontSize: 10,
    color: r.couleur.gris,
  },
  cardBody: {
    fontFamily: VIP_FONTS.palais.util,
    fontSize: 12,
    color: r.couleur.gris,
    lineHeight: 18,
  },
});
