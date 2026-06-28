import React, { useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
} from 'react-native';
import { colors, fonts, radius } from '../../theme';
import { NotifType } from '../../store/notificationsStore';
import useNotifPopupStore from '../../store/notifPopupStore';

// ─── Constantes par type ──────────────────────────────────────────────────────

const TAG_LABEL: Record<NotifType, string> = {
  vip:   'RÉCOMPENSE',
  pay:   'PAIEMENT',
  ann:   'ANNONCE',
  order: 'COMMANDE',
  msg:   'MESSAGE',
};

const LARGE_EMOJI: Record<NotifType, string> = {
  vip:   '🎁',
  pay:   '🎉',
  ann:   '📢',
  order: '🛍️',
  msg:   '💬',
};

// ─── Composant ────────────────────────────────────────────────────────────────

interface Props {
  onView: () => void; // ouvre l'écran Notifications complet
}

/**
 * Carte rich-notification style image1 LASSI — affichée une seule fois par
 * notification (tracké par ID via notifPopupStore / AsyncStorage).
 * Queue FIFO : si plusieurs notifications sont en attente, le bouton affiche
 * "Suivant (N)" jusqu'à la dernière qui affiche "C'est compris !".
 */
export default function NotifCardModal({ onView }: Props) {
  const queue   = useNotifPopupStore(s => s.queue);
  const dismiss = useNotifPopupStore(s => s.dismiss);

  const current    = queue[0] ?? null;
  const nbRestants = Math.max(queue.length - 1, 0);

  const handleCompris = useCallback(() => dismiss(), [dismiss]);
  const handleView    = useCallback(() => { dismiss(); onView(); }, [dismiss, onView]);

  if (!current) return null;

  const tag   = TAG_LABEL[current.type]  ?? 'LASSI';
  const emoji = LARGE_EMOJI[current.type] ?? '📬';

  return (
    <Modal visible animationType="fade" transparent onRequestClose={handleCompris}>
      <View style={s.overlay}>
        <View style={s.card}>

          {/* Tag pill */}
          <View style={s.tagPill}>
            <Text style={s.tagTxt}>{tag}</Text>
          </View>

          {/* Grande icône */}
          <Text style={s.emoji}>{emoji}</Text>

          {/* Titre */}
          <Text style={s.title}>{current.title}</Text>

          {/* Corps — scrollable si long */}
          <ScrollView
            style={s.bodyWrap}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <Text style={s.body}>{current.body}</Text>
          </ScrollView>

          {/* Bouton principal */}
          <TouchableOpacity style={s.cta} onPress={handleCompris} activeOpacity={0.85}>
            <Text style={s.ctaTxt}>
              {nbRestants > 0 ? `Suivant (${nbRestants})` : "C'est compris !"}
            </Text>
          </TouchableOpacity>

          {/* Lien discret vers le centre de notifs */}
          <TouchableOpacity style={s.viewBtn} onPress={handleView} activeOpacity={0.7}>
            <Text style={s.viewTxt}>Voir mes notifications</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    maxHeight: '80%',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.accent,
    borderRadius: radius.xl,
    padding: 22,
    alignItems: 'center',
    gap: 6,
  },
  tagPill: {
    backgroundColor: 'rgba(253,207,52,.15)',
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 5,
    marginBottom: 8,
  },
  tagTxt: {
    color: colors.accent,
    fontFamily: fonts.ui,
    fontSize: 11,
    letterSpacing: 0.8,
  },
  emoji: {
    fontSize: 46,
    marginBottom: 4,
  },
  title: {
    color: colors.white,
    fontFamily: fonts.titleXL,
    fontSize: 18,
    textAlign: 'center',
    lineHeight: 24,
  },
  bodyWrap: {
    maxHeight: 180,
    width: '100%',
    marginTop: 6,
    marginBottom: 14,
  },
  body: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
  cta: {
    width: '100%',
    height: 50,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaTxt: {
    color: colors.bg,
    fontFamily: fonts.titleXL,
    fontSize: 15,
  },
  viewBtn: {
    marginTop: 10,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  viewTxt: {
    color: colors.muted,
    fontFamily: fonts.ui,
    fontSize: 12,
    textDecorationLine: 'underline',
  },
});
