import React, { useEffect } from 'react';
import {
  View, Text, TouchableOpacity,
  ScrollView, StyleSheet,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts, radius, TOP_INSET } from '../../theme';
import useNotificationsStore, { NotifType, Notif } from '../../store/notificationsStore';
import { IcoBack } from '../../components/icons';

// ─── Icônes ───────────────────────────────────────────────────────────────────

const IcoOrder = ({ color }: { color: string }) => (
  <Svg width={19} height={19} viewBox="0 0 24 24" fill="none" strokeWidth={1.8}>
    <Path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" stroke={color} />
    <Path d="M3 6h18M16 10a4 4 0 0 1-8 0" stroke={color} />
  </Svg>
);

const IcoPay = ({ color }: { color: string }) => (
  <Svg width={19} height={19} viewBox="0 0 24 24" fill="none" strokeWidth={1.8}>
    <Path d="M20 6 9 17l-5-5" stroke={color} />
  </Svg>
);

const IcoStar = ({ color }: { color: string }) => (
  <Svg width={19} height={19} viewBox="0 0 24 24" fill="none" strokeWidth={1.8}>
    <Path d="M12 2 15 9 22 9 16 14 18 21 12 17 6 21 8 14 2 9 9 9z" stroke={color} />
  </Svg>
);

const IcoMsg = ({ color }: { color: string }) => (
  <Svg width={19} height={19} viewBox="0 0 24 24" fill="none" strokeWidth={1.8}>
    <Path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke={color} />
  </Svg>
);

const TYPE_CONFIG: Record<NotifType, { Icon: React.FC<{ color: string }>; color: string; bg: string }> = {
  order: { Icon: IcoOrder, color: colors.accent,  bg: 'rgba(253,207,52,.13)' },
  pay:   { Icon: IcoPay,   color: colors.success, bg: 'rgba(95,211,138,.13)' },
  vip:   { Icon: IcoStar,  color: colors.orange,  bg: 'rgba(240,168,71,.13)' },
  msg:   { Icon: IcoMsg,   color: colors.accent,  bg: 'rgba(253,207,52,.13)' },
};

function NotifCard({ notif, onPress }: { notif: Notif; onPress: () => void }) {
  const cfg = TYPE_CONFIG[notif.type];
  const { Icon } = cfg;
  return (
    <TouchableOpacity
      style={[styles.card, notif.unread && styles.cardUnread]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {notif.unread && <View style={styles.dot} />}
      <View style={[styles.iconBox, { backgroundColor: cfg.bg }]}>
        <Icon color={cfg.color} />
      </View>
      <View style={styles.content}>
        <Text style={styles.title}>{notif.title}</Text>
        <Text style={styles.body}>{notif.body}</Text>
        <Text style={styles.time}>{notif.time}</Text>
      </View>
    </TouchableOpacity>
  );
}

interface Props {
  onBack:       () => void;
  onNavigate?:  (type: NotifType, targetId?: string) => void;
}

export default function NotificationsScreen({ onBack, onNavigate }: Props) {
  const notifications     = useNotificationsStore(s => s.notifications);
  const markRead          = useNotificationsStore(s => s.markRead);
  const markAllRead       = useNotificationsStore(s => s.markAllRead);
  const loadNotifications = useNotificationsStore(s => s.loadNotifications);

  // Montage seul — chargement + marquage lu une seule fois à l'ouverture de l'écran
  useEffect(() => {
    loadNotifications();
    markAllRead();   // toutes les notifs marquées lues → badge retombe à 0
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const todayNotifs = notifications.filter(n => n.group === 'today');
  const weekNotifs  = notifications.filter(n => n.group === 'week');

  return (
    <View style={styles.root}>
      <View style={[styles.head, { paddingTop: TOP_INSET + 4 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.75}>
          <IcoBack />
        </TouchableOpacity>
        <Text style={styles.headTitle}>Notifications</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32, flexGrow: 1 }}
      >
        {notifications.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyTxt}>Aucune notification</Text>
          </View>
        )}

        {todayNotifs.length > 0 && (
          <>
            <Text style={styles.dayLbl}>Aujourd'hui</Text>
            {todayNotifs.map(n => (
              <NotifCard
                key={n.id}
                notif={n}
                onPress={() => {
                  markRead(n.id);
                  onNavigate?.(n.type, n.targetId);
                }}
              />
            ))}
          </>
        )}

        {weekNotifs.length > 0 && (
          <>
            <Text style={styles.dayLbl}>Cette semaine</Text>
            {weekNotifs.map(n => (
              <NotifCard
                key={n.id}
                notif={n}
                onPress={() => {
                  markRead(n.id);
                  onNavigate?.(n.type, n.targetId);
                }}
              />
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: colors.bg },
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
  title:   { color: colors.white, fontFamily: fonts.title,  fontSize: 13.5 },
  body:    { color: colors.muted, fontFamily: fonts.body,   fontSize: 11.5, marginTop: 2, lineHeight: 16 },
  time:    { color: '#5a5c80',    fontFamily: fonts.body,   fontSize: 10, marginTop: 5 },

  empty:    { paddingVertical: 60, alignItems: 'center' },
  emptyTxt: { color: colors.muted, fontFamily: fonts.body, fontSize: 13 },
});
