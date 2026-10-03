import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts, radius } from '../../theme';
import { IcoClose } from '../../components/icons';
import ClientScoreBadge from '../../components/orders/ClientScoreBadge';
import {
  getMerchantOrdersForVerify,
  verifyReceiptMerchant,
  MerchantOrderReceipt,
  VerifyResult,
} from '../../services/receipts';
import { getErrorMessage } from '../../utils/errorUtils';
import { formatPrice } from '../../utils/format';

// ─── Icônes ──────────────────────────────────────────────────────────────────

const IcoCheck = () => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" strokeWidth={2.5} strokeLinecap="round">
    <Path d="M20 6 9 17l-5-5" stroke={colors.success} />
  </Svg>
);

const IcoX = () => <IcoClose size={22} color={colors.danger} />;

const IcoReceipt = () => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" strokeWidth={2} strokeLinecap="round">
    <Path d="M9 11l3 3L22 4" stroke={colors.accent} />
    <Path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" stroke={colors.accent} />
  </Svg>
);

// ─── Badge statut ─────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  valide:  { label: 'Valide',   color: colors.success },
  utilise: { label: 'Utilisé',  color: colors.muted },
  expire:  { label: 'Expiré',   color: colors.danger },
  aucun:   { label: 'En cours', color: colors.accent },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_BADGE[status] ?? STATUS_BADGE.aucun;
  return (
    <View style={[s.statusBadge, { borderColor: cfg.color + '44', backgroundColor: cfg.color + '18' }]}>
      <Text style={[s.statusTxt, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}

// ─── Formatage code reçu ──────────────────────────────────────────────────────

function fmtCode(code: string): string {
  const c = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return c.length >= 4 ? `${c.slice(0, 4)} ${c.slice(4)}` : c;
}

// ─── Composant principal ─────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  shopId: string | null;
  onClose: () => void;
  onVerified?: (result: VerifyResult) => void;
}

export default function VerifyReceiptSheet({ visible, shopId, onClose, onVerified }: Props) {
  const [orders, setOrders]       = useState<MerchantOrderReceipt[]>([]);
  const [fetching, setFetching]   = useState(false);
  const [verifying, setVerifying] = useState<string | null>(null); // orderId en cours
  const [results, setResults]     = useState<Record<string, VerifyResult>>({});

  const load = useCallback(async () => {
    if (!shopId) return;
    setFetching(true);
    try {
      const list = await getMerchantOrdersForVerify(shopId);
      setOrders(list);
    } catch {
      setOrders([]);
    } finally {
      setFetching(false);
    }
  }, [shopId]);

  useEffect(() => {
    if (visible) {
      setResults({});
      load();
    }
  }, [visible, load]);

  const handleVerify = async (order: MerchantOrderReceipt) => {
    if (verifying || results[order.orderId]) return;
    setVerifying(order.orderId);
    try {
      const res = await verifyReceiptMerchant(order.receiptCode);
      setResults(prev => ({ ...prev, [order.orderId]: res }));
      if (res.success) {
        onVerified?.(res);
        // Met à jour le statut localement
        setOrders(prev =>
          prev.map(o =>
            o.orderId === order.orderId ? { ...o, receiptStatus: 'utilise' } : o,
          ),
        );
      }
    } catch (e: unknown) {
      setResults(prev => ({
        ...prev,
        [order.orderId]: { success: false, reason: getErrorMessage(e, 'erreur_reseau') },
      }));
    } finally {
      setVerifying(null);
    }
  };

  const handleClose = () => {
    setResults({});
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      presentationStyle="overFullScreen"
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={s.overlay}>
        <TouchableOpacity style={s.backdrop} onPress={handleClose} activeOpacity={1} />

        <View style={s.sheet}>
          {/* Poignée */}
          <View style={s.grab} />

          {/* En-tête */}
          <View style={s.header}>
            <Text style={s.title}>Vérifier un reçu client</Text>
            <TouchableOpacity style={s.closeBtn} onPress={handleClose} activeOpacity={0.7}>
              <IcoClose color={colors.muted} />
            </TouchableOpacity>
          </View>
          <Text style={s.subtitle}>
            Sélectionne la commande du client pour valider son reçu automatiquement.
          </Text>

          {/* Corps */}
          {fetching ? (
            <ActivityIndicator color={colors.accent} style={{ marginVertical: 28 }} />
          ) : orders.length === 0 ? (
            <View style={s.empty}>
              <Text style={s.emptyTxt}>Aucune commande avec reçu dans les dernières 72h.</Text>
            </View>
          ) : (
            <ScrollView
              style={s.list}
              contentContainerStyle={{ paddingBottom: 24 }}
              showsVerticalScrollIndicator={false}
            >
              {orders.map(order => {
                const res = results[order.orderId];
                const isVerifying = verifying === order.orderId;
                const alreadyUsed = order.receiptStatus === 'utilise';
                const alreadyExpired = order.receiptStatus === 'expire';
                const disabled = alreadyUsed || alreadyExpired || !!res || isVerifying;

                return (
                  <View key={order.orderId} style={s.row}>
                    {/* Infos commande */}
                    <View style={s.rowTop}>
                      <View style={s.rowLeft}>
                        <Text style={s.clientName}>{order.clientName}</Text>
                        <View style={s.rowMeta}>
                          <Text style={s.displayId}>{order.displayId}</Text>
                          <Text style={s.metaSep}>·</Text>
                          <Text style={s.total}>{formatPrice(order.total)}</Text>
                        </View>
                      </View>
                      <StatusBadge status={res?.success ? 'utilise' : order.receiptStatus} />
                    </View>

                    {/* Code reçu — même format que le client */}
                    <View style={s.codeWrap}>
                      <IcoReceipt />
                      <Text style={s.codeText}>{fmtCode(order.receiptCode)}</Text>
                    </View>

                    {/* Résultat inline */}
                    {res && (
                      <View style={[s.result, res.success ? s.resultOk : s.resultErr]}>
                        {res.success ? <IcoCheck /> : <IcoX />}
                        <View style={{ flex: 1 }}>
                          {res.success ? (
                            <>
                              <Text style={s.resultOkTxt}>Reçu validé ✓</Text>
                              {res.clientName && (
                                <Text style={s.resultSub}>Client : {res.clientName}</Text>
                              )}
                              {res.total !== undefined && (
                                <Text style={s.resultSub}>Total : {formatPrice(res.total)}</Text>
                              )}
                              {res.clientScore !== undefined && !!res.clientNbNotes && (
                                <View style={{ marginTop: 4 }}>
                                  <ClientScoreBadge score={res.clientScore} nbNotes={res.clientNbNotes} />
                                </View>
                              )}
                            </>
                          ) : (
                            <Text style={s.resultErrTxt}>
                              {res.reason === 'expire'
                                ? 'Reçu expiré.'
                                : res.reason === 'deja_utilise'
                                ? 'Déjà utilisé.'
                                : 'Erreur de vérification.'}
                            </Text>
                          )}
                        </View>
                      </View>
                    )}

                    {/* Bouton vérifier */}
                    {!res && (
                      <TouchableOpacity
                        style={[s.verifyBtn, disabled && s.verifyBtnDisabled]}
                        onPress={() => handleVerify(order)}
                        disabled={disabled}
                        activeOpacity={0.85}
                      >
                        {isVerifying ? (
                          <ActivityIndicator color={colors.bg} size="small" />
                        ) : (
                          <Text style={s.verifyBtnTxt}>
                            {alreadyUsed ? 'Déjà utilisé' : alreadyExpired ? 'Expiré' : 'Valider ce reçu'}
                          </Text>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  backdrop: { ...StyleSheet.absoluteFillObject },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderColor: colors.border,
    maxHeight: '85%',
  },
  grab: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginTop: 10, marginBottom: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  title: { color: colors.white, fontFamily: fonts.titleXL, fontSize: 17 },
  closeBtn: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: colors.bg,
    borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  subtitle: {
    color: colors.muted, fontFamily: fonts.body,
    fontSize: 13, lineHeight: 19, marginBottom: 18,
  },
  empty: { paddingVertical: 32, alignItems: 'center' },
  emptyTxt: { color: colors.muted, fontFamily: fonts.body, fontSize: 14 },
  list: { flex: 1 },

  // Ligne commande
  row: {
    backgroundColor: colors.bg,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 10,
  },
  rowTop: {
    flexDirection: 'row', alignItems: 'flex-start',
    justifyContent: 'space-between', marginBottom: 10,
  },
  rowLeft: { flex: 1, marginRight: 10 },
  clientName: { color: colors.white, fontFamily: fonts.title, fontSize: 14, marginBottom: 4 },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  displayId: { color: colors.muted, fontFamily: fonts.body, fontSize: 12 },
  metaSep: { color: colors.border, fontSize: 12 },
  total: { color: colors.accent, fontFamily: fonts.title, fontSize: 12 },

  statusBadge: {
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 8, borderWidth: 1,
  },
  statusTxt: { fontFamily: fonts.ui, fontSize: 11 },

  // Code reçu
  codeWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 12, paddingVertical: 8,
    marginBottom: 12,
  },
  codeText: {
    color: colors.white, fontFamily: fonts.titleXL,
    fontSize: 20, letterSpacing: 6,
  },

  // Résultat
  result: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    borderRadius: radius.sm, padding: 12, marginBottom: 10,
  },
  resultOk: {
    backgroundColor: 'rgba(95,211,138,0.10)',
    borderWidth: 1, borderColor: 'rgba(95,211,138,0.3)',
  },
  resultErr: {
    backgroundColor: 'rgba(224,122,122,0.10)',
    borderWidth: 1, borderColor: 'rgba(224,122,122,0.3)',
  },
  resultOkTxt: { color: colors.success, fontFamily: fonts.title, fontSize: 14, marginBottom: 2 },
  resultSub: { color: colors.white, fontFamily: fonts.body, fontSize: 12 },
  resultErrTxt: { color: colors.danger, fontFamily: fonts.body, fontSize: 13 },

  // Bouton vérifier
  verifyBtn: {
    height: 44, borderRadius: radius.sm,
    backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  verifyBtnDisabled: { opacity: 0.35 },
  verifyBtnTxt: { color: colors.bg, fontFamily: fonts.title, fontSize: 14 },
});
