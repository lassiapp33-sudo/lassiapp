import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import Svg, { Line } from 'react-native-svg';
import { colors, fonts, radius, TOP_INSET } from '../../theme';
import { IcoBack } from '../../components/icons';
import { formatPrice } from '../../utils/format';
import useAuthStore from '../../store/authStore';
import * as fitnessService from '../../services/fitnessAbonnements';
import { FitnessAbonnement } from '../../services/fitnessAbonnements';

// ─── Icônes ──────────────────────────────────────────────────────────────────

const IcoX = () => (
  <Svg width={48} height={48} viewBox="0 0 24 24" fill="none" strokeWidth={2}>
    <Line x1="18" y1="6" x2="6" y2="18" stroke={colors.danger} strokeLinecap="round" />
    <Line x1="6" y1="6" x2="18" y2="18" stroke={colors.danger} strokeLinecap="round" />
  </Svg>
);

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  onBack: () => void;
}

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

// ─── Carte abonné ─────────────────────────────────────────────────────────────
function AbonneCard({ abo }: { abo: FitnessAbonnement }) {
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
  const dateAchatFr = dateAchat.toLocaleDateString('fr-FR', {
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
        {/* Nom client + offre */}
        <Text style={styles.clientName}>{abo.clientName ?? 'Client'}</Text>
        <Text style={styles.nomOffre}>{abo.nomOffre}</Text>

        {/* Jours restants */}
        {!isExpired ? (
          <>
            <Text style={styles.joursNum}>{joursRestant}</Text>
            <Text style={styles.joursSub}>jour{joursRestant > 1 ? 's' : ''} restant{joursRestant > 1 ? 's' : ''}</Text>
            <ProgressBar pct={pct} />
          </>
        ) : (
          <Text style={styles.expiredDate}>Expiré le {dateExpFr}</Text>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <View>
            <Text style={styles.footerLabel}>Souscrit le</Text>
            <Text style={styles.footerVal}>{dateAchatFr}</Text>
          </View>
          <Text style={styles.prixPaye}>{formatPrice(abo.prixPaye)}</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Écran principal ──────────────────────────────────────────────────────────
export default function MerchantAbonnementsScreen({ onBack }: Props) {
  const userId = useAuthStore(s => s.user?.id);
  const [abonnements, setAbonnements] = useState<FitnessAbonnement[]>([]);
  const [loading, setLoading]         = useState(true);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const list = await fitnessService.getMesAbonnes(userId);
      const actifs  = list.filter(a => !fitnessService.isExpireLocalement(a) && a.statut === 'actif')
        .sort((a, b) => new Date(a.dateExpiration).getTime() - new Date(b.dateExpiration).getTime());
      const expires = list.filter(a => fitnessService.isExpireLocalement(a) || a.statut === 'expire')
        .sort((a, b) => new Date(b.dateExpiration).getTime() - new Date(a.dateExpiration).getTime());
      setAbonnements([...actifs, ...expires]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const actifCount = abonnements.filter(a => !fitnessService.isExpireLocalement(a) && a.statut === 'actif').length;

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
          <IcoBack />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Mes abonnés</Text>
          {!loading && (
            <Text style={styles.headerSub}>
              {actifCount} abonné{actifCount !== 1 ? 's' : ''} actif{actifCount !== 1 ? 's' : ''}
            </Text>
          )}
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : abonnements.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyTxt}>Aucun abonné pour l'instant.</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {abonnements.map(abo => <AbonneCard key={abo.id} abo={abo} />)}
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

  clientName: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 16,
    marginBottom: 2,
  },
  nomOffre: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
    marginBottom: 10,
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
  footerLabel: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  footerVal: {
    color: colors.white,
    fontFamily: fonts.ui,
    fontSize: 12,
  },
  prixPaye: {
    color: colors.accent,
    fontFamily: fonts.titleXL,
    fontSize: 15,
  },
});
