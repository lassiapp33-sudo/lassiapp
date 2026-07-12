import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts, radius } from '../../theme';
import Avatar from '../Avatar';
import { getBlocsActifs } from '../../services/aLaUne';
import type { BlocALaUne, ElementALaUne } from '../../types/aLaUne';
import { formatPrice } from '../../utils/format';

// ─── Icônes ──────────────────────────────────────────────────────────────────

const IcoFlame = () => (
  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <Path
      d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"
      stroke={colors.accent}
    />
  </Svg>
);

// ─── Countdown live ───────────────────────────────────────────────────────────

function useCountdown(expireAt: string): string {
  const [label, setLabel] = useState('');
  useEffect(() => {
    const calc = () => {
      const ms = new Date(expireAt).getTime() - Date.now();
      if (ms <= 0) return setLabel('Expiré');
      const h = Math.floor(ms / 3_600_000);
      const m = Math.floor((ms % 3_600_000) / 60_000);
      setLabel(h > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${m} min`);
    };
    calc();
    const id = setInterval(calc, 60_000);
    return () => clearInterval(id);
  }, [expireAt]);
  return label;
}

// ─── Carte élément ────────────────────────────────────────────────────────────

interface ElCardProps {
  el: ElementALaUne;
  onPress?: () => void;
}

function ElCard({ el, onPress }: ElCardProps) {
  return (
    <TouchableOpacity style={styles.elCard} onPress={onPress} activeOpacity={0.8}>
      <Text style={styles.elNom} numberOfLines={2}>{el.nom}</Text>
      <Text style={styles.elPrix}>{formatPrice(el.prix)}</Text>
      <View style={styles.elVoirRow}>
        <Text style={styles.elVoirTxt}>Voir →</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Carte bloc ───────────────────────────────────────────────────────────────

interface BlocCardProps {
  bloc: BlocALaUne;
  onBlocPress?: (blocId: string, elementId?: string) => void;
}

function BlocCard({ bloc, onBlocPress }: BlocCardProps) {
  const countdown = useCountdown(bloc.expire_at);

  return (
    <View style={styles.blocCard}>
      <TouchableOpacity onPress={() => onBlocPress?.(bloc.id)} activeOpacity={0.7}>
        <View style={styles.blocHeader}>
          <Avatar
            name={bloc.shop_name ?? '?'}
            imageUrl={bloc.shop_logo_url ?? null}
            size={34}
            variant="shop"
          />
          <View style={styles.blocHeaderText}>
            <Text style={styles.shopName} numberOfLines={1}>{bloc.shop_name ?? 'Boutique'}</Text>
            <Text style={styles.blocTitre} numberOfLines={1}>{bloc.titre}</Text>
          </View>
          <View style={styles.countdownPill}>
            <Text style={styles.countdownTxt}>⏳ {countdown}</Text>
          </View>
        </View>
      </TouchableOpacity>

      {bloc.description ? (
        <Text style={styles.blocDesc} numberOfLines={2}>{bloc.description}</Text>
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.elRow}
      >
        {bloc.elements.map(el => (
          <ElCard key={el.id} el={el} onPress={() => onBlocPress?.(bloc.id, el.id)} />
        ))}
      </ScrollView>
    </View>
  );
}

// ─── Section principale ───────────────────────────────────────────────────────

interface Props {
  catId: string;
  subCatId?: string;
  onBlocPress?: (blocId: string, elementId?: string) => void;
}

export default function AlaUneSection({ catId, subCatId, onBlocPress }: Props) {
  const [blocs, setBlocs] = useState<BlocALaUne[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getBlocsActifs(catId, subCatId)
      .then(setBlocs)
      .catch(() => setBlocs([]))
      .finally(() => setLoading(false));
  }, [catId, subCatId]);

  if (loading) {
    return (
      <View style={styles.loadingBox}>
        <ActivityIndicator color={colors.accent} size="small" />
      </View>
    );
  }

  if (blocs.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <IcoFlame />
        <Text style={styles.sectionTitle}>À la une</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countBadgeTxt}>{blocs.length}</Text>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.blocsList}
      >
        {blocs.map(b => (
          <BlocCard key={b.id} bloc={b} onBlocPress={onBlocPress} />
        ))}
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  loadingBox: { paddingVertical: 12, alignItems: 'center' },

  section: { marginBottom: 4 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  sectionTitle: { color: colors.white, fontFamily: fonts.title, fontSize: 14, flex: 1 },
  countBadge: {
    backgroundColor: colors.accent + '22',
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  countBadgeTxt: { color: colors.accent, fontFamily: fonts.ui, fontSize: 11 },

  blocsList: { paddingHorizontal: 20, gap: 12, paddingBottom: 4 },

  blocCard: {
    width: 280,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.accent + '35',
    borderRadius: radius.lg,
    padding: 14,
  },
  blocHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  blocHeaderText: { flex: 1 },
  shopName: { color: colors.muted, fontFamily: fonts.body, fontSize: 10.5 },
  blocTitre: { color: colors.white, fontFamily: fonts.title, fontSize: 13 },
  countdownPill: {
    backgroundColor: colors.accent + '20',
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  countdownTxt: { color: colors.accent, fontFamily: fonts.ui, fontSize: 10 },

  blocDesc: { color: colors.muted, fontFamily: fonts.body, fontSize: 11.5, marginBottom: 10 },

  elRow: { gap: 8 },
  elCard: {
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    padding: 10,
    width: 130,
  },
  elNom: { color: colors.white, fontFamily: fonts.label, fontSize: 12, marginBottom: 2 },
  elPrix: { color: colors.accent, fontFamily: fonts.ui, fontSize: 12, marginBottom: 8 },
  elVoirRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 6,
  },
  elVoirTxt: { color: colors.muted, fontFamily: fonts.body, fontSize: 10.5 },
});
