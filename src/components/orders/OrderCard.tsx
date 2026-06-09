import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { colors, fonts } from '../../theme';
import { IncomingOrder } from '../../types/orders';
import Avatar from '../Avatar';
import { IcoClose } from '../icons';
import { formatPrice } from '../../utils/format';

// Couleurs spécifiques aux boutons d'action
const WAVE_COLOR = '#1DC8F2';
const WAVE_TEXT = '#062a33';
const GREEN_TEXT = '#06301a';

// ─── Icônes inline ────────────────────────────────────────────────────────────

const IcoCheck = ({ color }: { color: string }) => (
  <Svg
    width={16}
    height={16}
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth={2.4}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Path d="M20 6 9 17l-5-5" stroke={color} />
  </Svg>
);

const IcoChat = () => (
  <Svg
    width={16}
    height={16}
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Path
      d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
      stroke={colors.accent}
    />
  </Svg>
);

const IcoClock = () => (
  <Svg width={11} height={11} viewBox="0 0 24 24" fill="none" strokeWidth={2}>
    <Circle cx={12} cy={12} r={10} stroke={colors.success} />
    <Path d="M12 6v6l4 2" stroke={colors.success} />
  </Svg>
);

// ─── Config badge de statut ───────────────────────────────────────────────────

const BADGE_CFG = {
  new: { label: 'NOUVELLE', bg: 'rgba(95,211,138,.15)', color: colors.success },
  preparing: { label: 'CONFIRMÉE', bg: 'rgba(240,168,71,.15)', color: colors.orange },
  ready: { label: 'EN COURS', bg: `rgba(29,200,242,.15)`, color: WAVE_COLOR },
  done: { label: 'TERMINÉE', bg: 'rgba(95,211,138,.08)', color: colors.muted },
  refused: { label: 'ANNULÉE', bg: 'rgba(224,122,122,.15)', color: colors.danger },
};

// ─── Composant ────────────────────────────────────────────────────────────────

interface Props {
  order: IncomingOrder;
  onAccept: () => void; // ouvre le choix du temps de préparation
  onRefuse: () => void;
  onChat: () => void;
  onReady: () => void; // "En prép" → "Prête"
  onDone: () => void; // "Prête" → "Terminée"
}

function OrderCard({ order, onAccept, onRefuse, onChat, onReady, onDone }: Props) {
  const badge = BADGE_CFG[order.status];
  const isNew = order.status === 'new';

  return (
    <View style={[styles.card, isNew && styles.cardNew]}>
      {/* ── En-tête : client + n° commande + badge statut ──────────────────── */}
      <View style={styles.top}>
        {/* Avatar client — Avatar unique, source de vérité profiles.avatar_url */}
        <Avatar imageUrl={order.avatarUrl} name={order.clientName} size={42} variant="user" />

        {/* Infos client */}
        <View style={styles.who}>
          <Text style={styles.clientName}>{order.clientName}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.orderId}>{order.orderId}</Text>
            <Text style={styles.metaSep}>·</Text>
            {isNew ? (
              // Timer animé pour les nouvelles commandes (urgence)
              <View style={styles.timerRow}>
                <IcoClock />
                <Text style={styles.timerTxt}>{order.timeLabel}</Text>
              </View>
            ) : (
              <Text style={styles.timeLbl}>{order.timeLabel}</Text>
            )}
          </View>
        </View>

        {/* Badge statut */}
        <View style={[styles.badge, { backgroundColor: badge.bg }]}>
          <Text style={[styles.badgeTxt, { color: badge.color }]}>{badge.label}</Text>
        </View>
      </View>

      {/* ── Articles commandés ──────────────────────────────────────────────── */}
      <View style={styles.items}>
        {order.items.map((item, i) => (
          <View key={i} style={styles.itemRow}>
            <Text style={styles.itemName}>
              <Text style={styles.itemQty}>{item.qty}× </Text>
              {item.name}
            </Text>
            <Text style={styles.itemPrice}>{formatPrice(item.price)}</Text>
          </View>
        ))}

        {/* Ligne paiement + total */}
        <View style={styles.paidSep} />
        <View style={styles.paidRow}>
          <View style={styles.payTag}>
            <IcoCheck color={colors.success} />
            <Text style={styles.payTagTxt}>
              Payé via {order.payMethod === 'wave' ? 'Wave' : 'OM'}
            </Text>
          </View>
          <View style={styles.rightCol}>
            {order.orderType != null && (
              <View
                style={[
                  styles.orderTypeTag,
                  order.orderType === 'place' ? styles.orderTypePlace : styles.orderTypeEmporter,
                ]}
              >
                <Text
                  style={[
                    styles.orderTypeTxt,
                    { color: order.orderType === 'place' ? '#5FD38A' : colors.accent },
                  ]}
                >
                  {order.orderType === 'place' ? '🍽 Sur place' : '🥡 À emporter'}
                </Text>
              </View>
            )}
            <Text style={styles.total}>{formatPrice(order.total)}</Text>
          </View>
        </View>
      </View>

      {/* ── Raison de refus ─────────────────────────────────────────────────── */}
      {order.status === 'refused' && order.refusalReason && (
        <View style={styles.refusalBanner}>
          <Text style={styles.refusalTxt}>Motif : {order.refusalReason}</Text>
        </View>
      )}

      {/* ── Boutons d'action selon le statut ────────────────────────────────── */}
      {order.status !== 'done' && order.status !== 'refused' && (
        <View style={styles.acts}>
          {/* Nouvelle : ❌ Refuser | 💬 Chat | ✅ Confirmer */}
          {order.status === 'new' && (
            <>
              <TouchableOpacity style={styles.btnSquare} onPress={onRefuse} activeOpacity={0.8}>
                <IcoClose color={colors.muted} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnChat} onPress={onChat} activeOpacity={0.8}>
                <IcoChat />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnWide, styles.btnAccept]}
                onPress={onAccept}
                activeOpacity={0.85}
              >
                <IcoCheck color={colors.bg} />
                <Text style={[styles.btnWideTxt, { color: colors.bg }]}>Confirmer</Text>
              </TouchableOpacity>
            </>
          )}

          {/* Confirmée (preparing) : 💬 Chat | 🚀 Démarrer */}
          {order.status === 'preparing' && (
            <>
              <TouchableOpacity style={styles.btnChat} onPress={onChat} activeOpacity={0.8}>
                <IcoChat />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnWide, { backgroundColor: WAVE_COLOR }]}
                onPress={onReady}
                activeOpacity={0.85}
              >
                <IcoCheck color={WAVE_TEXT} />
                <Text style={[styles.btnWideTxt, { color: WAVE_TEXT }]}>Démarrer</Text>
              </TouchableOpacity>
            </>
          )}

          {/* En cours (ready) : 💬 Chat | ✔️ Terminer */}
          {order.status === 'ready' && (
            <>
              <TouchableOpacity style={styles.btnChat} onPress={onChat} activeOpacity={0.8}>
                <IcoChat />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnWide, { backgroundColor: colors.success }]}
                onPress={onDone}
                activeOpacity={0.85}
              >
                <IcoCheck color={GREEN_TEXT} />
                <Text style={[styles.btnWideTxt, { color: GREEN_TEXT }]}>Terminer</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}
    </View>
  );
}

export default React.memo(OrderCard);

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 18,
    marginBottom: 13,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    overflow: 'hidden',
  },
  // Bordure verte pour les nouvelles commandes — visibilité terrain
  cardNew: {
    borderColor: 'rgba(95,211,138,.4)',
  },

  // En-tête
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    padding: 13,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  who: { flex: 1, minWidth: 0 },
  clientName: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 14.5,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  orderId: {
    color: colors.accent,
    fontFamily: fonts.title,
    fontSize: 10.5,
  },
  metaSep: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 10.5,
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timerTxt: {
    color: colors.success,
    fontFamily: fonts.body,
    fontSize: 10,
  },
  timeLbl: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 10.5,
  },
  badge: {
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: 8,
    flexShrink: 0,
  },
  badgeTxt: {
    fontFamily: fonts.titleXL,
    fontSize: 9,
  },

  // Articles
  items: {
    padding: 11,
    paddingHorizontal: 14,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  itemName: {
    color: '#cfd0e0',
    fontFamily: fonts.body,
    fontSize: 12.5,
    flex: 1,
  },
  itemQty: {
    color: colors.white,
    fontFamily: fonts.title,
  },
  itemPrice: {
    color: colors.muted,
    fontFamily: fonts.ui,
    fontSize: 12,
  },

  // Séparateur + ligne paiement
  paidSep: {
    height: 1,
    backgroundColor: colors.border,
    marginTop: 5,
    marginBottom: 9,
  },
  paidRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  payTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  payTagTxt: {
    color: colors.success,
    fontFamily: fonts.title,
    fontSize: 10.5,
  },
  rightCol: {
    alignItems: 'flex-end',
    gap: 5,
  },
  orderTypeTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 7,
  },
  orderTypePlace: {
    backgroundColor: 'rgba(95,211,138,.12)',
  },
  orderTypeEmporter: {
    backgroundColor: 'rgba(253,207,52,.10)',
  },
  orderTypeTxt: {
    fontFamily: fonts.title,
    fontSize: 10,
  },
  total: {
    color: colors.accent,
    fontFamily: fonts.titleXL,
    fontSize: 16,
  },
  refusalBanner: {
    marginHorizontal: 14,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 9,
    backgroundColor: 'rgba(224,122,122,.08)',
    borderWidth: 1,
    borderColor: 'rgba(224,122,122,.2)',
  },
  refusalTxt: {
    color: colors.danger,
    fontFamily: fonts.body,
    fontSize: 11.5,
  },

  // Zone actions
  acts: {
    flexDirection: 'row',
    gap: 9,
    padding: 14,
    paddingTop: 0,
  },
  // Bouton carré icône (46×44)
  btnSquare: {
    width: 46,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  btnChat: {
    width: 46,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  // Bouton large (flex 1)
  btnWide: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  btnAccept: { backgroundColor: colors.accent },
  btnWideTxt: {
    fontFamily: fonts.title,
    fontSize: 13,
  },
});
