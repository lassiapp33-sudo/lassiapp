import React, { useEffect, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, SectionList, StyleSheet, ActivityIndicator } from 'react-native';
import { colors, fonts, radius, TOP_INSET } from '../../theme';
import useNotificationsStore, { NotifType, Notif } from '../../store/notificationsStore';
import { IcoBack } from '../../components/icons';

// ─── Icônes ───────────────────────────────────────────────────────────────────

import {
  IcoNotifOrder,
  IcoNotifPay,
  IcoNotifFitness,
  IcoNotifGift,
  IcoNotifMsg,
  IcoNotifAnn,
  IcoNotifLivraison,
} from '../../components/common/LassiIcons';

// Adaptateurs taille 19 pour les icônes LASSI dans les cards
const IcoOrder    = () => <IcoNotifOrder    size={19} />;
const IcoPay      = () => <IcoNotifPay      size={19} />;
const IcoFitness  = () => <IcoNotifFitness  size={19} />;
const IcoStar     = () => <IcoNotifGift     size={19} />;
const IcoMsg      = () => <IcoNotifMsg      size={19} />;
const IcoAnn      = () => <IcoNotifAnn      size={19} />;
const IcoTruck    = () => <IcoNotifLivraison size={19} />;

const TYPE_CONFIG: Record<
  NotifType,
  { Icon: React.FC; color: string; bg: string }
> = {
  order:     { Icon: IcoOrder,   color: colors.accent,  bg: 'rgba(253,207,52,.13)' },
  pay:       { Icon: IcoPay,     color: colors.success, bg: 'rgba(95,211,138,.13)' },
  fitness:   { Icon: IcoFitness, color: colors.orange,  bg: 'rgba(240,168,71,.13)' },
  vip:       { Icon: IcoStar,    color: colors.orange,  bg: 'rgba(240,168,71,.13)' },
  msg:       { Icon: IcoMsg,     color: colors.accent,  bg: 'rgba(253,207,52,.13)' },
  ann:       { Icon: IcoAnn,     color: colors.accent,  bg: 'rgba(253,207,52,.13)' },
  livraison: { Icon: IcoTruck,   color: colors.success, bg: 'rgba(95,211,138,.13)' },
};

const NotifCard = React.memo(function NotifCard({
  notif,
  onPress,
}: {
  notif: Notif;
  onPress: (n: Notif) => void;
}) {
  const cfg = TYPE_CONFIG[notif.type];
  const { Icon } = cfg;
  return (
    <TouchableOpacity
      style={[styles.card, notif.unread && styles.cardUnread]}
      onPress={() => onPress(notif)}
      activeOpacity={0.75}
    >
      {notif.unread && <View style={styles.dot} />}
      <View style={[styles.iconBox, { backgroundColor: cfg.bg }]}>
        <Icon />
      </View>
      <View style={styles.content}>
        <Text style={styles.title}>{notif.title}</Text>
        <Text style={styles.body}>{notif.body}</Text>
        <Text style={styles.time}>{notif.time}</Text>
      </View>
    </TouchableOpacity>
  );
});

interface Props {
  onBack: () => void;
  onNavigate?: (type: NotifType, targetId?: string, data?: Record<string, unknown>) => void;
}

export default function NotificationsScreen({ onBack, onNavigate }: Props) {
  const notifications = useNotificationsStore(s => s.notifications);
  const loading = useNotificationsStore(s => s.loading);
  const markRead = useNotificationsStore(s => s.markRead);
  const markAllRead = useNotificationsStore(s => s.markAllRead);
  const loadNotifications = useNotificationsStore(s => s.loadNotifications);

  // Charge les notifications (incl. annonces) puis marque tout comme lu
  useEffect(() => {
    loadNotifications().then(() => markAllRead());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const sections = useMemo(() => {
    const today = notifications.filter(n => n.group === 'today');
    const week = notifications.filter(n => n.group === 'week');
    return [
      ...(today.length > 0 ? [{ title: "Aujourd'hui", data: today }] : []),
      ...(week.length > 0 ? [{ title: 'Cette semaine', data: week }] : []),
    ];
  }, [notifications]);

  const handlePress = useCallback(
    (n: Notif) => {
      markRead(n.id);
      onNavigate?.(n.type, n.targetId, n.data);
    },
    [markRead, onNavigate],
  );

  const renderNotifItem = useCallback(
    ({ item }: { item: Notif }) => <NotifCard notif={item} onPress={handlePress} />,
    [handlePress],
  );

  return (
    <View style={styles.root}>
      <View style={[styles.head, { paddingTop: TOP_INSET + 4 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.75}>
          <IcoBack />
        </TouchableOpacity>
        <Text style={styles.headTitle}>Notifications</Text>
      </View>

      <SectionList
        style={styles.scroll}
        sections={sections}
        keyExtractor={item => item.id}
        renderItem={renderNotifItem}
        renderSectionHeader={({ section }) => <Text style={styles.dayLbl}>{section.title}</Text>}
        ListEmptyComponent={
          <View style={styles.empty}>
            {loading
              ? <ActivityIndicator color={colors.accent} />
              : <Text style={styles.emptyTxt}>Aucune notification</Text>
            }
          </View>
        }
        contentContainerStyle={{ paddingBottom: 32, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },

  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingBottom: 14,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headTitle: {
    color: colors.white,
    fontFamily: fonts.titleXL,
    fontSize: 20,
    flex: 1,
  },

  dayLbl: {
    color: colors.muted,
    fontFamily: fonts.ui,
    fontSize: 12,
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 12,
  },

  card: {
    marginHorizontal: 18,
    marginBottom: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 15,
    padding: 13,
    flexDirection: 'row',
    gap: 12,
  },
  cardUnread: {
    backgroundColor: 'rgba(253,207,52,.05)',
    borderColor: 'rgba(253,207,52,.2)',
  },
  dot: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  content: { flex: 1 },
  title: { color: colors.white, fontFamily: fonts.title, fontSize: 13.5 },
  body: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11.5,
    marginTop: 2,
    lineHeight: 16,
  },
  time: { color: '#5a5c80', fontFamily: fonts.body, fontSize: 10, marginTop: 5 },

  empty: { paddingVertical: 60, alignItems: 'center' },
  emptyTxt: { color: colors.muted, fontFamily: fonts.body, fontSize: 13 },
});
