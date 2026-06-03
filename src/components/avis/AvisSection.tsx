import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts, radius } from '../../theme';
import StarRating from './StarRating';
import AvisCard from './AvisCard';
import AvisForm from './AvisForm';
import { Avis } from '../../types/avis';
import * as avisService from '../../services/avis';

// ─── Icône étoile (plein, pour la moyenne) ────────────────────────────────────

const IcoStar = () => (
  <Svg width={16} height={16} viewBox="0 0 24 24">
    <Path
      d="M12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2z"
      fill={colors.accent}
    />
  </Svg>
);

const IcoWrite = () => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none"
    strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M12 20h9" stroke={colors.bg} />
    <Path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" stroke={colors.bg} />
  </Svg>
);

// ─── Barre de distribution ────────────────────────────────────────────────────

function DistBar({ label, count, total }: { label: string; count: number; total: number }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <View style={dist.row}>
      <Text style={dist.lbl}>{label}</Text>
      <View style={dist.track}>
        <View style={[dist.fill, { width: `${pct}%` as any }]} />
      </View>
      <Text style={dist.count}>{count}</Text>
    </View>
  );
}

const dist = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  lbl:   { color: colors.muted, fontFamily: fonts.body, fontSize: 11, width: 18 },
  track: { flex: 1, height: 6, backgroundColor: colors.border, borderRadius: 3, overflow: 'hidden' },
  fill:  { height: '100%', backgroundColor: colors.accent, borderRadius: 3 },
  count: { color: colors.muted, fontFamily: fonts.body, fontSize: 11, width: 18, textAlign: 'right' },
});

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  shopId:         string;
  shopName:       string;
  currentUserId?: string;
  isMerchant?:    boolean;
}

// ─── Composant ────────────────────────────────────────────────────────────────

export default function AvisSection({ shopId, shopName, currentUserId, isMerchant }: Props) {
  const [avisList,     setAvisList]     = useState<Avis[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [canLeave,     setCanLeave]     = useState(false);
  const [avisTarget,   setAvisTarget]   = useState<{
    existing?: Avis;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await avisService.getShopAvis(shopId);
      setAvisList(list);
    } catch {
      setAvisList([]);
    } finally {
      setLoading(false);
    }
  }, [shopId]);

  const checkCanLeave = useCallback(async () => {
    if (!currentUserId || isMerchant) return;
    try {
      const result = await avisService.canLeaveAvis(shopId, currentUserId);
      setCanLeave(result.canLeave);
    } catch {
      setCanLeave(false);
    }
  }, [shopId, currentUserId, isMerchant]);

  useEffect(() => {
    load();
    checkCanLeave();
  }, [load, checkCanLeave]);

  const handleOpenAvisForm = async () => {
    if (!currentUserId) return;
    const result = await avisService.canLeaveAvis(shopId, currentUserId);
    if (!result.canLeave) return;
    setAvisTarget({ existing: result.existingAvis });
  };

  const handleReport = (avisId: string) => {
    Alert.alert(
      'Signaler cet avis',
      'Un avis abusif, insultant ou faux sera masqué après vérification par l\'équipe LASSI.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Signaler', onPress: () => {
          // Création d'un signalement via le système existant
          // Pour l'instant on affiche une confirmation simple
          Alert.alert('Signalé', 'Merci. L\'équipe LASSI examinera cet avis.');
        }},
      ],
    );
  };

  // ── Statistiques ──────────────────────────────────────────────────────────
  const total = avisList.length;
  const avg   = total > 0
    ? avisList.reduce((s, a) => s + a.note, 0) / total
    : 0;
  const dist5 = [5, 4, 3, 2, 1].map(n => avisList.filter(a => a.note === n).length);

  return (
    <View style={styles.root}>
      {/* ── En-tête section ── */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Avis clients</Text>
        {canLeave && (
          <TouchableOpacity style={styles.writeBtn} onPress={handleOpenAvisForm} activeOpacity={0.8}>
            <IcoWrite />
            <Text style={styles.writeTxt}>Laisser un avis</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginVertical: 20 }} />
      ) : total === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTxt}>Aucun avis pour l'instant.</Text>
          {canLeave && (
            <Text style={styles.emptySub}>Sois le premier à noter ce commerce !</Text>
          )}
        </View>
      ) : (
        <>
          {/* ── Synthèse ── */}
          <View style={styles.summary}>
            <View style={styles.avgCol}>
              <View style={styles.avgRow}>
                <IcoStar />
                <Text style={styles.avgNum}>{avg.toFixed(1)}</Text>
              </View>
              <Text style={styles.avgSub}>{total} avis</Text>
              <StarRating value={Math.round(avg)} size={14} gap={3} />
            </View>
            <View style={styles.distCol}>
              {[5, 4, 3, 2, 1].map((n, i) => (
                <DistBar key={n} label={String(n)} count={dist5[i]} total={total} />
              ))}
            </View>
          </View>

          {/* ── Liste ── */}
          {avisList.map(a => (
            <AvisCard
              key={a.id}
              avis={a}
              isOwn={a.authorId === currentUserId}
              isMerchant={isMerchant}
              onEdit={() => setAvisTarget({ existing: a })}
              onDelete={async () => {
                try {
                  await avisService.deleteAvis(a.id);
                  load();
                  checkCanLeave();
                } catch {
                  Alert.alert('Erreur', 'Impossible de supprimer.');
                }
              }}
              onReport={() => handleReport(a.id)}
              onRefresh={() => { load(); checkCanLeave(); }}
            />
          ))}
        </>
      )}

      {/* ── Modal formulaire ── */}
      {avisTarget && (
        <AvisForm
          visible
          shopId={shopId}
          shopName={shopName}
          existingAvis={avisTarget.existing}
          onClose={() => setAvisTarget(null)}
          onSaved={() => { load(); checkCanLeave(); }}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 10,
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sectionTitle: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 17,
  },
  writeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  writeTxt: {
    color: colors.bg,
    fontFamily: fonts.ui,
    fontSize: 12.5,
  },

  empty: { paddingVertical: 20, alignItems: 'center' },
  emptyTxt: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
  },
  emptySub: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
    marginTop: 4,
  },

  summary: {
    flexDirection: 'row',
    gap: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 16,
  },
  avgCol: { alignItems: 'center', justifyContent: 'center', gap: 4, width: 70 },
  avgRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  avgNum: {
    color: colors.white,
    fontFamily: fonts.titleXL,
    fontSize: 28,
  },
  avgSub: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 10.5,
  },
  distCol: { flex: 1, justifyContent: 'center' },
});
