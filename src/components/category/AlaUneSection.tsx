import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Share,
  Linking,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { colors, fonts, radius } from '../../theme';
import Avatar from '../Avatar';
import { getBlocsAlaUneParCategorie, buildShareMessage } from '../../services/aLaUne';
import type { AlaUneBloc, AlaUneElement } from '../../types/aLaUne';
import { supabase } from '../../lib/supabase';
import { formatPrice } from '../../utils/format';

// ─── Icônes ──────────────────────────────────────────────────────────────────

const IcoFlame = ({ size = 14 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <Path
      d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"
      stroke={colors.accent}
    />
  </Svg>
);

const IcoShare = () => (
  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" stroke={colors.muted} />
    <Path d="M16 6l-4-4-4 4" stroke={colors.muted} />
    <Path d="M12 2v13" stroke={colors.muted} />
  </Svg>
);

// ─── Countdown ────────────────────────────────────────────────────────────────

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

// ─── Carte d'un élément partageable ──────────────────────────────────────────

interface ElCardProps {
  el: AlaUneElement;
  bloc: AlaUneBloc;
}

function ElCard({ el, bloc }: ElCardProps) {
  const message = buildShareMessage({
    elementNom: el.nom,
    elementPrix: el.prix,
    blocTitre: bloc.titre,
    blocDescription: bloc.description,
    shopName: bloc.shopName ?? 'Boutique',
    blocId: bloc.id,
    expireAt: bloc.expireAt,
  });

  const handleShare = async () => {
    const encoded = encodeURIComponent(message);
    try {
      const can = await Linking.canOpenURL('whatsapp://send?text=a');
      if (can) {
        await Linking.openURL(`whatsapp://send?text=${encoded}`);
        return;
      }
    } catch {}
    Share.share({ message });
  };

  return (
    <View style={styles.elCard}>
      <View style={styles.elCardInner}>
        <Text style={styles.elNom} numberOfLines={2}>{el.nom}</Text>
        <Text style={styles.elPrix}>{formatPrice(el.prix)}</Text>
      </View>
      <TouchableOpacity onPress={handleShare} style={styles.elShareBtn} activeOpacity={0.7}>
        <IcoShare />
        <Text style={styles.elShareTxt}>Partager</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Carte d'un bloc ──────────────────────────────────────────────────────────

function BlocCard({ bloc }: { bloc: AlaUneBloc }) {
  const countdown = useCountdown(bloc.expireAt);

  return (
    <View style={styles.blocCard}>
      {/* En-tête : avatar + nom boutique + countdown */}
      <View style={styles.blocHeader}>
        <Avatar
          name={bloc.shopName ?? '?'}
          imageUrl={bloc.shopLogoUrl ?? null}
          size={34}
          variant="shop"
        />
        <View style={styles.blocHeaderText}>
          <Text style={styles.shopName} numberOfLines={1}>{bloc.shopName ?? 'Boutique'}</Text>
          <Text style={styles.blocTitre} numberOfLines={1}>{bloc.titre}</Text>
        </View>
        <View style={styles.countdownPill}>
          <Text style={styles.countdownTxt}>⏳ {countdown}</Text>
        </View>
      </View>

      {bloc.description ? (
        <Text style={styles.blocDesc} numberOfLines={2}>{bloc.description}</Text>
      ) : null}

      {/* Éléments */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.elRow}
      >
        {bloc.elements.map(el => (
          <ElCard key={el.id} el={el} bloc={bloc} />
        ))}
      </ScrollView>
    </View>
  );
}

// ─── Section principale ───────────────────────────────────────────────────────

interface Props {
  catId: string;
  subCatId?: string;
}

export default function AlaUneSection({ catId, subCatId }: Props) {
  const [blocs, setBlocs] = useState<AlaUneBloc[]>([]);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const load = async () => {
    try {
      const data = await getBlocsAlaUneParCategorie(catId, subCatId);
      setBlocs(data);
    } catch {
      setBlocs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    load();

    const ch = supabase
      .channel(`alaune-cat-${catId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'a_la_une', filter: `categorie_id=eq.${catId}` },
        () => load(),
      )
      .subscribe();

    channelRef.current = ch;
    return () => {
      ch.unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
        <Text style={styles.sectionCount}>{blocs.length}</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.blocsList}
      >
        {blocs.map(b => (
          <BlocCard key={b.id} bloc={b} />
        ))}
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  loadingBox: { paddingVertical: 12, alignItems: 'center' },

  section: {
    marginBottom: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  sectionTitle: { color: colors.white, fontFamily: fonts.title, fontSize: 14, flex: 1 },
  sectionCount: {
    backgroundColor: colors.accent + '22',
    color: colors.accent,
    fontFamily: fonts.ui,
    fontSize: 11,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },

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
  elCardInner: { marginBottom: 8 },
  elNom: { color: colors.white, fontFamily: fonts.label, fontSize: 12 },
  elPrix: { color: colors.accent, fontFamily: fonts.ui, fontSize: 12, marginTop: 2 },
  elShareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 6,
  },
  elShareTxt: { color: colors.muted, fontFamily: fonts.body, fontSize: 10.5 },
});
