import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { colors, fonts, radius, TOP_INSET } from '../../theme';

// ─── Icônes ──────────────────────────────────────────────────────────────────

const IcoBack = () => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none"
    strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M19 12H5" stroke={colors.white} />
    <Path d="M12 19l-7-7 7-7" stroke={colors.white} />
  </Svg>
);

const IcoSearch = () => (
  <Svg width={19} height={19} viewBox="0 0 24 24" fill="none" strokeWidth={2}>
    <Circle cx={11} cy={11} r={8} stroke={colors.muted} />
    <Path d="m21 21-4.3-4.3" stroke={colors.muted} />
  </Svg>
);

const IcoStar = () => (
  <Svg width={10} height={10} viewBox="0 0 24 24"
    fill={colors.accent} stroke={colors.accent} strokeWidth={1}>
    <Path d="M12 2 15 9 22 9 16 14 18 21 12 17 6 21 8 14 2 9 9 9z" />
  </Svg>
);

// ─── Résultats mock (priorisés : VIP → Sponso → Proches) ─────────────────────

interface SearchResult {
  id:       string;
  initial:  string;
  name:     string;
  tag?:     'vip' | 'sponso';
  meta:     string;       // "4.9 · Medina" ou "Petit-déj express · 24h/24"
  hasStar:  boolean;
  distance: string;
}

const VIP_RESULTS: SearchResult[] = [
  { id: 'v1', initial: 'D', name: 'Tangana Diallo & Frères', tag: 'vip',    meta: '4.9 · Medina',           hasStar: true,  distance: '220 m' },
];

const SPONSO_RESULTS: SearchResult[] = [
  { id: 's1', initial: 'T', name: 'Tic Tac Resto',           tag: 'sponso', meta: 'Petit-déj express · 24h/24', hasStar: false, distance: '1.2 km' },
];

const NEARBY_RESULTS: SearchResult[] = [
  { id: 'n1', initial: 'M', name: 'Tangana Chez Modou',       meta: '4.8 · Ouvert',   hasStar: true, distance: '40 m'  },
  { id: 'n2', initial: 'A', name: 'Café Touba Assane',        meta: '4.5 · Ferme à 11h', hasStar: true, distance: '310 m' },
];

// ─── Sous-composants ──────────────────────────────────────────────────────────

function GroupLabel({ emoji, label, vip }: { emoji: string; label: string; vip?: boolean }) {
  return (
    <Text style={[styles.groupLbl, vip && styles.groupLblVip]}>
      {emoji} {label}
    </Text>
  );
}

function ResultCard({
  result, sponsored, onPress,
}: {
  result: SearchResult;
  sponsored?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.card, sponsored && styles.cardSponso]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {/* Avatar initial */}
      <View style={[styles.thumb, sponsored && styles.thumbSponso]}>
        <Text style={[styles.thumbTxt, sponsored && styles.thumbTxtSponso]}>
          {result.initial}
        </Text>
      </View>

      {/* Infos */}
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.name}>{result.name}</Text>
          {result.tag === 'vip'    && <View style={styles.tagVip}><Text style={styles.tagVipTxt}>VIP</Text></View>}
          {result.tag === 'sponso' && <View style={styles.tagSponso}><Text style={styles.tagSponsoTxt}>SPONSO</Text></View>}
        </View>
        <View style={styles.metaRow}>
          {result.hasStar && <View style={{ marginRight: 3 }}><IcoStar /></View>}
          <Text style={styles.meta}>{result.meta}</Text>
        </View>
      </View>

      {/* Distance */}
      <Text style={styles.dist}>{result.distance}</Text>
    </TouchableOpacity>
  );
}

// ─── Écran ────────────────────────────────────────────────────────────────────

interface Props {
  initialQuery?: string;
  onBack:        () => void;
  onShopPress:   (shopId: string, shopName: string) => void;
}

export default function SearchScreen({ initialQuery = '', onBack, onShopPress }: Props) {
  const [query, setQuery] = useState(initialQuery);

  const q = query.trim().toLowerCase();
  const matches = (r: SearchResult) => !q || r.name.toLowerCase().includes(q);

  const vipFiltered    = VIP_RESULTS.filter(matches);
  const sponsoFiltered = SPONSO_RESULTS.filter(matches);
  const nearbyFiltered = NEARBY_RESULTS.filter(matches);
  const hasResults     = vipFiltered.length + sponsoFiltered.length + nearbyFiltered.length > 0;

  return (
    <View style={styles.root}>
      {/* En-tête */}
      <View style={[styles.head, { paddingTop: TOP_INSET + 4 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.75}>
          <IcoBack />
        </TouchableOpacity>
        <Text style={styles.headTitle}>Recherche</Text>
      </View>

      {/* Barre de recherche active */}
      <View style={styles.searchBar}>
        <IcoSearch />
        <TextInput
          style={styles.input}
          placeholder="Cherche un commerce, un plat…"
          placeholderTextColor="#5a5c80"
          value={query}
          onChangeText={setQuery}
          autoFocus
          returnKeyType="search"
        />
      </View>

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32, flexGrow: 1 }}
      >
        {/* État vide */}
        {q && !hasResults && (
          <View style={styles.empty}>
            <Text style={styles.emptyTxt}>Aucun résultat pour « {query} »</Text>
          </View>
        )}

        {/* ① Top VIP */}
        {vipFiltered.length > 0 && (
          <>
            <GroupLabel emoji="🏆" label="Top 3 VIP de Dakar" vip />
            {vipFiltered.map(r => (
              <ResultCard key={r.id} result={r} onPress={() => onShopPress(r.id, r.name)} />
            ))}
          </>
        )}

        {/* ② Recommandés / Sponsorisés */}
        {sponsoFiltered.length > 0 && (
          <>
            <GroupLabel emoji="✨" label="Recommandé" />
            {sponsoFiltered.map(r => (
              <ResultCard key={r.id} result={r} sponsored onPress={() => onShopPress(r.id, r.name)} />
            ))}
          </>
        )}

        {/* ③ Proches */}
        {nearbyFiltered.length > 0 && (
          <>
            <GroupLabel emoji="📍" label="Près de toi" />
            {nearbyFiltered.map(r => (
              <ResultCard key={r.id} result={r} onPress={() => onShopPress(r.id, r.name)} />
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },

  // Header
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingBottom: 14,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headTitle: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 17,
    flex: 1,
  },

  // Barre de recherche
  searchBar: {
    marginHorizontal: 18,
    marginBottom: 18,
    height: 50,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 10,
  },
  input: {
    flex: 1,
    color: colors.white,
    fontFamily: fonts.body,
    fontSize: 14,
  },

  // Labels groupes
  groupLbl: {
    color: colors.muted,
    fontFamily: fonts.ui,
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    paddingHorizontal: 18,
    paddingBottom: 10,
    paddingTop: 6,
  },
  groupLblVip: { color: colors.accent },

  // Carte résultat
  card: {
    marginHorizontal: 18,
    marginBottom: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  cardSponso: { borderColor: colors.accent },

  thumb: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#2a2c52',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  thumbSponso: { backgroundColor: colors.accent },
  thumbTxt: {
    color: colors.accent,
    fontFamily: fonts.titleXL,
    fontSize: 16,
  },
  thumbTxtSponso: { color: colors.bg },

  info: { flex: 1, minWidth: 0 },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  name: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 14,
    flexShrink: 1,
  },

  tagVip: {
    backgroundColor: 'rgba(253,207,52,.15)',
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tagVipTxt: {
    color: colors.accent,
    fontFamily: fonts.titleXL,
    fontSize: 8,
  },
  tagSponso: {
    backgroundColor: colors.accent,
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tagSponsoTxt: {
    color: colors.bg,
    fontFamily: fonts.titleXL,
    fontSize: 8,
  },

  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  meta: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11,
  },

  dist: {
    color: colors.accent,
    fontFamily: fonts.ui,
    fontSize: 12,
    flexShrink: 0,
  },

  empty: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  emptyTxt: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 14,
  },
});
