import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { colors, fonts, radius } from '../../theme';
import { ClientOrder, ClientOrderStatus, CommerceType } from '../../types/clientOrders';
import { formatPrice } from '../../utils/format';

// ─── Icônes ──────────────────────────────────────────────────────────────────

const IcoFood = () => (
  <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" strokeWidth={1.8} strokeLinecap="round">
    <Path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" stroke={colors.accent} />
    <Path d="M7 2v20" stroke={colors.accent} />
    <Path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" stroke={colors.accent} />
  </Svg>
);

const IcoBeauty = () => (
  <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" strokeWidth={1.8} strokeLinecap="round">
    <Path d="m6 3 6 6 6-6" stroke={colors.accent} />
    <Path d="M20 21a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2" stroke={colors.accent} />
    <Path d="m8 21 8-18" stroke={colors.accent} />
  </Svg>
);

const IcoService = () => (
  <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" strokeWidth={1.8} strokeLinecap="round">
    <Path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"
      stroke={colors.accent} />
  </Svg>
);

const IcoOther = () => (
  <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" strokeWidth={1.8} strokeLinecap="round">
    <Rect x={3}  y={3}  width={7} height={7} rx={1} stroke={colors.accent} />
    <Rect x={14} y={3}  width={7} height={7} rx={1} stroke={colors.accent} />
    <Rect x={3}  y={14} width={7} height={7} rx={1} stroke={colors.accent} />
    <Rect x={14} y={14} width={7} height={7} rx={1} stroke={colors.accent} />
  </Svg>
);

const IcoWave = () => (
  <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" strokeWidth={2} strokeLinecap="round">
    <Path d="M2 12c2-4 4-6 6-6s4 6 6 6 4-6 6-6" stroke={colors.muted} />
  </Svg>
);

const IcoOM = () => (
  <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" strokeWidth={2}>
    <Circle cx={12} cy={12} r={9} stroke={colors.muted} />
    <Path d="M12 8v8M8 12h8" stroke={colors.muted} strokeLinecap="round" />
  </Svg>
);

const IcoReceipt = () => (
  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" strokeWidth={2} strokeLinecap="round">
    <Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke={colors.accent} />
    <Path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke={colors.accent} />
  </Svg>
);

const IcoReorder = () => (
  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none"
    strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M1 4v6h6M23 20v-6h-6" stroke={colors.bg} />
    <Path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 0 1 3.51 15" stroke={colors.bg} />
  </Svg>
);

// ─── Config statique ──────────────────────────────────────────────────────────

const TYPE_ICONS: Record<CommerceType, React.ReactElement> = {
  food:    <IcoFood />,
  beauty:  <IcoBeauty />,
  service: <IcoService />,
  other:   <IcoOther />,
};

const TYPE_LABELS: Record<CommerceType, string> = {
  food:    'Restauration',
  beauty:  'Beauté & coiffure',
  service: 'Service',
  other:   'Autre',
};

const STATUS_CFG: Record<ClientOrderStatus, { label: string; dot: string; text: string; bg: string }> = {
  pending:     { label: 'En attente', dot: '#FDCF34', text: '#FDCF34', bg: 'rgba(253,207,52,0.12)'  },
  in_progress: { label: 'En cours',   dot: '#F0A847', text: '#F0A847', bg: 'rgba(240,168,71,0.12)'  },
  ready:       { label: 'Prête ✓',    dot: '#60A5FA', text: '#60A5FA', bg: 'rgba(96,165,250,0.12)'  },
  completed:   { label: 'Terminée',   dot: '#5FD38A', text: '#5FD38A', bg: 'rgba(95,211,138,0.12)'  },
  cancelled:   { label: 'Annulée',    dot: '#E07A7A', text: '#E07A7A', bg: 'rgba(224,122,122,0.12)' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function formatOrderDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

export function summarizeOrderItems(items: { name: string; qty?: number }[]): string {
  if (!items.length) return '—';
  const parts = items.slice(0, 3).map(i =>
    i.qty && i.qty > 1 ? `${i.qty}× ${i.name}` : i.name
  );
  return parts.join(', ') + (items.length > 3 ? ` +${items.length - 3}` : '');
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ClientOrderCardProps {
  order:          ClientOrder;
  onCancel:       (id: string) => void;
  onReorder:      (order: ClientOrder) => void;
  isReordering:   boolean;
  onLeaveAvis?:   () => void;
  onViewReceipt?: (orderId: string) => void;
}

// ─── Composant ────────────────────────────────────────────────────────────────

export function ClientOrderCard({
  order, onCancel, onReorder, isReordering, onLeaveAvis, onViewReceipt,
}: ClientOrderCardProps) {
  const cfg        = STATUS_CFG[order.status];
  const isPending  = order.status === 'pending';
  const canReorder = order.status === 'completed' || order.status === 'cancelled';
  const canAvis    = order.status === 'completed' && !order.avisId;
  const hasReceipt = !!order.receiptCode && order.receiptStatus !== 'aucun';

  return (
    <View style={s.wrap}>
      {/* Nom + badge statut */}
      <View style={s.top}>
        <Text style={s.name} numberOfLines={1}>{order.commerceName}</Text>
        <View style={[s.badge, { backgroundColor: cfg.bg }]}>
          <View style={[s.dot, { backgroundColor: cfg.dot }]} />
          <Text style={[s.badgeTxt, { color: cfg.text }]}>{cfg.label}</Text>
        </View>
      </View>

      {/* Type de commerce */}
      <View style={s.typeRow}>
        {TYPE_ICONS[order.commerceType]}
        <Text style={s.typeLabel}>{TYPE_LABELS[order.commerceType]}</Text>
      </View>

      {/* Articles */}
      <Text style={s.items} numberOfLines={2}>{summarizeOrderItems(order.items)}</Text>

      {/* Notes */}
      {!!order.notes && (
        <Text style={s.notes} numberOfLines={1}>« {order.notes} »</Text>
      )}

      <View style={s.divider} />

      {/* Pied : montant + paiement + date */}
      <View style={s.footer}>
        <Text style={s.amount}>{formatPrice(order.totalAmount)}</Text>
        <View style={s.payRow}>
          {order.paymentMethod === 'wave' ? <IcoWave /> : <IcoOM />}
          <Text style={s.payLabel}>
            {order.paymentMethod === 'wave' ? 'Wave' : 'Orange Money'}
          </Text>
        </View>
        <Text style={s.date}>{formatOrderDate(order.createdAt)}</Text>
      </View>

      {/* Bouton reçu */}
      {hasReceipt && (
        <TouchableOpacity
          style={[
            s.receiptBtn,
            order.receiptStatus === 'utilise' && s.receiptBtnUsed,
            order.receiptStatus === 'expire'  && s.receiptBtnExpired,
          ]}
          onPress={() => onViewReceipt?.(order.id)}
          activeOpacity={0.85}
        >
          <IcoReceipt />
          <Text style={[
            s.receiptTxt,
            order.receiptStatus === 'utilise' && { color: colors.muted },
            order.receiptStatus === 'expire'  && { color: colors.danger },
          ]}>
            {order.receiptStatus === 'utilise'
              ? '✓ Reçu utilisé'
              : order.receiptStatus === 'expire'
                ? 'Reçu expiré'
                : 'Voir le reçu'}
          </Text>
        </TouchableOpacity>
      )}

      {/* Bouton annulation (pending uniquement) */}
      {isPending && (
        <TouchableOpacity style={s.cancelBtn} onPress={() => onCancel(order.id)} activeOpacity={0.8}>
          <Text style={s.cancelTxt}>Annuler la commande</Text>
        </TouchableOpacity>
      )}

      {/* Invitation avis (commande terminée sans avis) */}
      {canAvis && (
        <TouchableOpacity style={s.avisBtn} onPress={onLeaveAvis} activeOpacity={0.85}>
          <Text style={s.avisBtnTxt}>⭐ Comment s'est passée ta commande ?</Text>
        </TouchableOpacity>
      )}

      {/* Avis déjà laissé */}
      {order.status === 'completed' && order.avisId && (
        <View style={s.avisLeft}>
          <Text style={s.avisLeftTxt}>✓ Avis publié</Text>
        </View>
      )}

      {/* Bouton reorder */}
      {canReorder && (
        <TouchableOpacity
          style={[s.reorderBtn, isReordering && s.reorderBtnLoading]}
          onPress={() => !isReordering && onReorder(order)}
          activeOpacity={0.85}
          disabled={isReordering}
        >
          {isReordering ? (
            <ActivityIndicator size="small" color={colors.bg} />
          ) : (
            <>
              <IcoReorder />
              <Text style={s.reorderTxt}>Commander à nouveau</Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  wrap: {
    marginHorizontal: 18,
    marginBottom: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 16,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 8,
  },
  name: {
    flex: 1,
    color: colors.white,
    fontFamily: fonts.ui,
    fontSize: 15,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: radius.pill,
    flexShrink: 0,
  },
  dot:      { width: 7, height: 7, borderRadius: 4 },
  badgeTxt: { fontFamily: fonts.ui, fontSize: 11 },
  typeRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  typeLabel: { color: colors.muted, fontFamily: fonts.body, fontSize: 11.5 },
  items:    { color: colors.white, fontFamily: fonts.body, fontSize: 13, lineHeight: 19, marginBottom: 4 },
  notes:    { color: colors.muted, fontFamily: fonts.body, fontSize: 11.5, fontStyle: 'italic', marginBottom: 4 },
  divider:  { height: 1, backgroundColor: colors.border, marginVertical: 12 },
  footer:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
  amount:   { color: colors.accent, fontFamily: fonts.title, fontSize: 14, flex: 1 },
  payRow:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
  payLabel: { color: colors.muted, fontFamily: fonts.body, fontSize: 11 },
  date:     { color: colors.muted, fontFamily: fonts.body, fontSize: 11 },

  receiptBtn: {
    marginTop: 10, height: 40, borderRadius: radius.sm,
    borderWidth: 1, borderColor: 'rgba(253,207,52,.4)',
    backgroundColor: 'rgba(253,207,52,.08)',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
  },
  receiptBtnUsed:    { borderColor: colors.border, backgroundColor: 'transparent' },
  receiptBtnExpired: { borderColor: 'rgba(224,122,122,.35)', backgroundColor: 'rgba(224,122,122,.07)' },
  receiptTxt: { color: colors.accent, fontFamily: fonts.ui, fontSize: 13 },

  cancelBtn: {
    marginTop: 12, paddingVertical: 10, borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.danger, alignItems: 'center',
  },
  cancelTxt: { color: colors.danger, fontFamily: fonts.ui, fontSize: 13 },

  reorderBtn: {
    marginTop: 10, height: 42, borderRadius: radius.sm,
    backgroundColor: colors.accent,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  reorderBtnLoading: { opacity: 0.7 },
  reorderTxt: { color: colors.bg, fontFamily: fonts.titleXL, fontSize: 13.5 },

  avisBtn: {
    marginTop: 10, paddingVertical: 10, borderRadius: radius.sm,
    borderWidth: 1, borderColor: 'rgba(253,207,52,.4)',
    backgroundColor: 'rgba(253,207,52,.08)', alignItems: 'center',
  },
  avisBtnTxt: { color: colors.accent, fontFamily: fonts.ui, fontSize: 13 },
  avisLeft:   { marginTop: 8, alignItems: 'center' },
  avisLeftTxt: { color: colors.success, fontFamily: fonts.body, fontSize: 11.5 },
});
