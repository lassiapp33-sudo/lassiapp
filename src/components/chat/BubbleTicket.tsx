import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { colors, fonts, radius } from '../../theme';

// ─── Icônes ──────────────────────────────────────────────────────────────────

const IcoReceipt = ({ color }: { color: string }) => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" strokeWidth={1.8}>
    <Path d="M4 4h16v16l-2-1-2 1-2-1-2 1-2-1-2 1-2-1-2 1V4Z" stroke={color} />
    <Path d="M8 9h8M8 13h5" stroke={color} />
  </Svg>
);

const IcoCard = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"
    strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <Rect x={2} y={5} width={20} height={14} rx={2} stroke={colors.bg} />
    <Path d="M2 10h20" stroke={colors.bg} />
  </Svg>
);

const IcoCheck = () => (
  <Svg width={17} height={17} viewBox="0 0 24 24" fill="none"
    strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M20 6 9 17l-5-5" stroke={colors.success} />
  </Svg>
);

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TicketItem {
  qty:   number;
  name:  string;
  price: number;
}

interface Props {
  sender:  'me' | 'them';
  orderId: string;
  items:   TicketItem[];
  total:   number;
  paid:    boolean;
  time:    string;
  read?:   boolean;
  onPay?:  () => void;  // déclenché quand l'utilisateur tape "Payer"
}

// ─── Ticket ───────────────────────────────────────────────────────────────────

export default function BubbleTicket({ sender, orderId, items, total, paid, time, read, onPay }: Props) {
  const isMe    = sender === 'me';
  const showPay = !isMe && !paid && !!onPay;  // bouton visible seulement côté "them" non payé

  const headBg    = paid
    ? 'rgba(95,211,138,.1)'
    : 'rgba(253,207,52,.1)';
  const headColor = paid ? colors.success : colors.accent;
  const borderColor = paid ? colors.success : colors.accent;

  return (
    <View style={[styles.row, isMe ? styles.rowMe : styles.rowThem]}>
      <View style={[styles.ticket, { borderColor }]}>

        {/* En-tête : icon + titre + tag */}
        <View style={[styles.thead, { backgroundColor: headBg }]}>
          <IcoReceipt color={headColor} />
          <Text style={styles.theadTitle}>
            {paid ? `Commande ${orderId}` : 'Ticket de commande'}
          </Text>
          <Text style={[styles.theadTag, { color: headColor }]}>
            {paid ? 'Payée' : orderId}
          </Text>
        </View>

        {/* Corps */}
        <View style={styles.tbody}>
          {paid ? (
            // Version payée : résumé minimal
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Montant réglé</Text>
              <Text style={[styles.totalValue, { color: colors.success }]}>
                {total.toLocaleString('fr-FR')} F
              </Text>
            </View>
          ) : (
            // Version normale : détail des articles + total
            <>
              {items.map((item, i) => (
                <View key={i} style={styles.line}>
                  <Text style={styles.lineLeft}>
                    <Text style={styles.lineQty}>{item.qty}×  </Text>
                    {item.name}
                  </Text>
                  <Text style={styles.linePrice}>
                    {item.price.toLocaleString('fr-FR')} F
                  </Text>
                </View>
              ))}
              <View style={styles.separator} />
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total à payer</Text>
                <Text style={[styles.totalValue, { color: colors.accent }]}>
                  {total.toLocaleString('fr-FR')} F
                </Text>
              </View>
            </>
          )}
        </View>

        {/* Bouton Payer — visible seulement si non payé et côté "them" */}
        {showPay && (
          <TouchableOpacity style={styles.payBtn} onPress={onPay} activeOpacity={0.85}>
            <IcoCard />
            <Text style={styles.payTxt}>
              Payer · <Text style={styles.paySubTxt}>Wave / OM</Text>
            </Text>
          </TouchableOpacity>
        )}

        {/* Tampon "Payé" — affiché quand paid */}
        {paid && (
          <View style={styles.paidStamp}>
            <IcoCheck />
            <Text style={styles.paidTxt}>Payé via Wave ✓</Text>
          </View>
        )}
      </View>

      <Text style={[styles.time, isMe ? styles.timeMe : styles.timeThem]}>
        {time}{isMe && read ? ' ✓✓' : isMe ? ' ✓' : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { maxWidth: '90%' },
  rowMe:   { alignSelf: 'flex-end', alignItems: 'flex-end' },
  rowThem: { alignSelf: 'flex-start', alignItems: 'flex-start' },

  ticket: {
    width: 256,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderRadius: 18,
    overflow: 'hidden',
  },

  // En-tête ticket
  thead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  theadTitle: {
    flex: 1,
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 13,
  },
  theadTag: {
    fontFamily: fonts.body,
    fontSize: 9,
    fontWeight: '700',
  },

  // Corps ticket
  tbody: {
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  line: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  lineLeft: {
    color: '#cfd0e0',
    fontFamily: fonts.body,
    fontSize: 12.5,
    flex: 1,
  },
  lineQty: {
    color: colors.white,
    fontFamily: fonts.title,
  },
  linePrice: {
    color: colors.white,
    fontFamily: fonts.ui,
    fontSize: 12.5,
  },

  separator: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 8,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    color: colors.muted,
    fontFamily: fonts.ui,
    fontSize: 12,
  },
  totalValue: {
    fontFamily: fonts.titleXL,
    fontSize: 18,
  },

  // Bouton payer
  payBtn: {
    marginHorizontal: 14,
    marginBottom: 14,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  payTxt: {
    color: colors.bg,
    fontFamily: fonts.titleXL,
    fontSize: 13.5,
  },
  paySubTxt: {
    fontFamily: fonts.ui,
    fontSize: 13,
    opacity: 0.7,
  },

  // Tampon payé
  paidStamp: {
    marginHorizontal: 14,
    marginBottom: 14,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: 'rgba(95,211,138,.12)',
    borderWidth: 1,
    borderColor: colors.success,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  paidTxt: {
    color: colors.success,
    fontFamily: fonts.title,
    fontSize: 13,
  },

  time: {
    color: '#5a5c80',
    fontFamily: fonts.body,
    fontSize: 9.5,
    marginTop: 4,
  },
  timeMe:   { marginRight: 3 },
  timeThem: { marginLeft: 3 },
});
