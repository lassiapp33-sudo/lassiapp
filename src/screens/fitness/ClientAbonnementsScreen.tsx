import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import Svg, { Path, Line } from 'react-native-svg';
import { colors, fonts, radius, TOP_INSET } from '../../theme';
import { IcoBack } from '../../components/icons';
import Avatar from '../../components/Avatar';
import { formatPrice } from '../../utils/format';
import useAuthStore from '../../store/authStore';
import * as fitnessService from '../../services/fitnessAbonnements';
import { FitnessAbonnement } from '../../services/fitnessAbonnements';
import { getFastCache, setFastCache } from '../../lib/fastCache';

// ─── Icônes ──────────────────────────────────────────────────────────────────

const IcoX = () => (
  <Svg width={64} height={64} viewBox="0 0 24 24" fill="none" strokeWidth={2}>
    <Line x1="18" y1="6" x2="6" y2="18" stroke={colors.danger} strokeLinecap="round" />
    <Line x1="6" y1="6" x2="18" y2="18" stroke={colors.danger} strokeLinecap="round" />
  </Svg>
);

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  onBack: () => void;
}

type Tab = 'formules' | 'abonnements';

// ─── Barre de progression ────────────────────────────────────────────────────
function ProgressBar({ pct }: { pct: number }) {
  const filled = Math.max(0, Math.min(1, pct));
  return (
    <View style={pb.track}>
      <View style={[pb.fill, { flex: filled }]} />
      <View style={{ flex: 1 - filled }} />
    </View>
  );
}
const pb = StyleSheet.create({
  track: {
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.border,
    flexDirection: 'row',
    overflow: 'hidden',
    marginTop: 8,
  },
  fill: { backgroundColor: colors.accent, borderRadius: 3 },
});

// ─── Carte formule / abonnement ───────────────────────────────────────────────
function AboCard({ abo }: { abo: FitnessAbonnement }) {
  const expireLocal  = fitnessService.isExpireLocalement(abo);
  const isExpired    = abo.statut === 'expire' || expireLocal;
  const joursRestant = isExpired ? 0 : fitnessService.joursRestants(abo.dateExpiration);

  const dateAchat = new Date(abo.dateAchat);
  const dateExp   = new Date(abo.dateExpiration);
  const dureeMs   = dateExp.getTime() - dateAchat.getTime();
  const dureeTot  = Math.round(dureeMs / 86_400_000) || 30;
  const pct       = joursRestant / dureeTot;

  const dateExpFr = dateExp.toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <View style={[styles.card, isExpired && styles.cardExpired]}>
      {isExpired && (
        <View style={styles.expiredOverlay} pointerEvents="none">
          <IcoX />
          <Text style={styles.expiredLabel}>EXPIRÉ</Text>
        </View>
      )}

      <View style={[styles.cardContent, isExpired && { opacity: 0.5 }]}>
        {(abo.shopName ?? abo.prestataireName) ? (
          <View style={styles.prestataireRow}>
            <Avatar
              imageUrl={abo.shopLogo ?? abo.prestataireAvatar}
              name={(abo.shopName ?? abo.prestataireName) as string}
              size={36}
              variant="shop"
            />
            <Text style={styles.prestataireName}>{abo.shopName ?? abo.prestataireName}</Text>
          </View>
        ) : null}

        <Text style={styles.nomOffre}>{abo.nomOffre}</Text>

        {!isExpired ? (
          <>
            <Text style={styles.joursNum}>{joursRestant}</Text>
            <Text style={styles.joursSub}>jour{joursRestant > 1 ? 's' : ''} restant{joursRestant > 1 ? 's' : ''}</Text>
            <ProgressBar pct={pct} />
          </>
        ) : (
          <Text style={styles.expiredDate}>Expiré le {dateExpFr}</Text>
        )}

        <View style={styles.footer}>
          <Text style={styles.prixPaye}>{formatPrice(abo.prixPaye)}</Text>
          {!isExpired && (
            <Text style={styles.expDateFull}>jusqu'au {dateExpFr}</Text>
          )}
        </View>
      </View>
    </View>
  );
}

// ─── Écran principal ──────────────────────────────────────────────────────────
export default function ClientAbonnementsScreen({ onBack }: Props) {
  const userId = useAuthStore(s => s.user?.id);
  const [all, setAll]         = useState<FitnessAbonnement[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState<Tab>('formules');

  const load = useCallback(async () => {
    if (!userId) { setLoading(false); return; }

    const cached = await getFastCache<FitnessAbonnement[]>(`abonnements_${userId}`);
    if (cached) {
      setAll(cached);
      setLoading(false);
      fitnessService.getMesAbonnements(userId)
        .then(fresh => { setAll(fresh); setFastCache(`abonnements_${userId}`, fresh); })
        .catch(() => {});
      return;
    }

    setLoading(true);
    try {
      const list = await Promise.race([
        fitnessService.getMesAbonnements(userId),
        new Promise<FitnessAbonnement[]>(resolve => setTimeout(() => resolve([]), 6000)),
      ]);
      setAll(list);
      setFastCache(`abonnements_${userId}`, list);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  // Formules = tout ce qui n'est PAS categorie 'abonnements' (ou null)
  const formules = all
    .filter(a => a.categorieTab !== 'abonnements')
    .sort((a, b) => new Date(b.dateAchat).getTime() - new Date(a.dateAchat).getTime());

  // Abonnements = categorie 'abonnements' ET actifs uniquement
  const abonnementsActifs = all
    .filter(a => a.categorieTab === 'abonnements' && a.statut === 'actif' && !fitnessService.isExpireLocalement(a))
    .sort((a, b) => new Date(a.dateExpiration).getTime() - new Date(b.dateExpiration).getTime());

  const items = tab === 'formules' ? formules : abonnementsActifs;

  const emptyMsg = tab === 'formules'
    ? "Tu n'as pas encore acheté de formule fitness."
    : "Tu n'as pas d'abonnement fitness actif.";

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
          <IcoBack />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Mes formules et abonnements</Text>
          {!loading && (
            <Text style={styles.headerSub}>
              {tab === 'formules'
                ? `${formules.length} formule${formules.length !== 1 ? 's' : ''}`
                : `${abonnementsActifs.length} actif${abonnementsActifs.length !== 1 ? 's' : ''}`}
            </Text>
          )}
        </View>
      </View>

      {/* Onglets */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'formules' && styles.tabBtnActive]}
          onPress={() => setTab('formules')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabLabel, tab === 'formules' && styles.tabLabelActive]}>
            Formules
          </Text>
          {formules.length > 0 && (
            <View style={[styles.badge, tab === 'formules' && styles.badgeActive]}>
              <Text style={[styles.badgeTxt, tab === 'formules' && styles.badgeTxtActive]}>
                {formules.length}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, tab === 'abonnements' && styles.tabBtnActive]}
          onPress={() => setTab('abonnements')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabLabel, tab === 'abonnements' && styles.tabLabelActive]}>
            Abonnements
          </Text>
          {abonnementsActifs.length > 0 && (
            <View style={[styles.badge, tab === 'abonnements' && styles.badgeActive]}>
              <Text style={[styles.badgeTxt, tab === 'abonnements' && styles.badgeTxtActive]}>
                {abonnementsActifs.length}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Contenu */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyTxt}>{emptyMsg}</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {items.map(abo => <AboCard key={abo.id} abo={abo} />)}
        </ScrollView>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },

  header: {
    paddingTop: TOP_INSET + 12,
    paddingBottom: 12,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { padding: 4 },
  headerTitle: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 16,
  },
  headerSub: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
    marginTop: 1,
  },

  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 18,
    paddingVertical: 12,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'transparent',
  },
  tabBtnActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  tabLabel: {
    color: colors.muted,
    fontFamily: fonts.title,
    fontSize: 13,
  },
  tabLabelActive: {
    color: colors.bg,
  },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeActive: {
    backgroundColor: colors.bg,
  },
  badgeTxt: {
    color: colors.muted,
    fontFamily: fonts.title,
    fontSize: 10,
  },
  badgeTxtActive: {
    color: colors.accent,
  },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyTxt: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 32,
  },

  scroll: { flex: 1 },
  scrollContent: { padding: 18, gap: 14 },

  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  cardExpired: {
    borderColor: 'rgba(224,122,122,.3)',
  },
  cardContent: { padding: 18 },

  expiredOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    gap: 4,
  },
  expiredLabel: {
    color: colors.danger,
    fontFamily: fonts.titleXL,
    fontSize: 18,
    letterSpacing: 2,
  },

  prestataireRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  prestataireName: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 15,
    flex: 1,
  },

  nomOffre: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
    marginBottom: 8,
  },

  joursNum: {
    color: colors.accent,
    fontFamily: fonts.titleXL,
    fontSize: 42,
    lineHeight: 48,
  },
  joursSub: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
  },

  expiredDate: {
    color: colors.danger,
    fontFamily: fonts.body,
    fontSize: 13,
    marginTop: 8,
  },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  prixPaye: {
    color: colors.accent,
    fontFamily: fonts.titleXL,
    fontSize: 14,
  },
  expDateFull: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11,
  },
});
