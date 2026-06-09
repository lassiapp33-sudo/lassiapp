import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet,
  TouchableOpacity, Image, ActivityIndicator,
} from 'react-native';
import { getTerrains } from '../../services/terrains';
import { Terrain, SportType, SPORT_EMOJI, SPORT_LABEL } from '../../types/terrain';
import { colors, fonts, radius, TOP_INSET } from '../../theme';
import { IcoBack } from '../../components/icons';
import { formatPrice } from '../../utils/format';

const SPORTS: { label: string; value: SportType | 'tous' }[] = [
  { label: '📋 Tous', value: 'tous' },
  { label: '⚽ Football', value: 'football' },
  { label: '🏀 Basketball', value: 'basketball' },
  { label: '🎾 Tennis', value: 'tennis' },
  { label: '🏐 Volleyball', value: 'volleyball' },
  { label: '🏟️ Autre', value: 'autre' },
];

interface Props {
  onBack: () => void;
  onSelectTerrain: (terrain: Terrain) => void;
  initialSport?: SportType;
}

export default function TerrainsListScreen({ onBack, onSelectTerrain, initialSport }: Props) {
  const [terrains, setTerrains] = useState<Terrain[]>([]);
  const [filtre, setFiltre] = useState<SportType | 'tous'>(initialSport ?? 'tous');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getTerrains(filtre === 'tous' ? undefined : filtre)
      .then(setTerrains)
      .finally(() => setLoading(false));
  }, [filtre]);

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: TOP_INSET + 4 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.8}>
          <IcoBack />
        </TouchableOpacity>
        <Text style={styles.title}>Terrains disponibles</Text>
      </View>

      {/* Filtres sport */}
      <FlatList
        horizontal
        data={SPORTS}
        keyExtractor={s => s.value}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsRow}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.chip, filtre === item.value && styles.chipActive]}
            onPress={() => setFiltre(item.value)}
            activeOpacity={0.8}
          >
            <Text style={[styles.chipText, filtre === item.value && styles.chipTextActive]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* Liste */}
      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={terrains}
          keyExtractor={t => t.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTxt}>Aucun terrain disponible</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => onSelectTerrain(item)}
              activeOpacity={0.85}
            >
              {item.images[0] ? (
                <Image source={{ uri: item.images[0] }} style={styles.img} />
              ) : (
                <View style={styles.imgPlaceholder}>
                  <Text style={styles.imgEmoji}>{SPORT_EMOJI[item.sport_type]}</Text>
                </View>
              )}
              <View style={styles.info}>
                <View style={styles.infoTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.nom}>{item.nom}</Text>
                    <Text style={styles.sport}>{SPORT_LABEL[item.sport_type]}</Text>
                  </View>
                  <Text style={styles.prix}>{formatPrice(item.prix_horaire)}/h</Text>
                </View>
                {item.adresse ? (
                  <Text style={styles.adresse} numberOfLines={1}>{item.adresse}</Text>
                ) : null}
                {item.capacite > 0 && (
                  <Text style={styles.capacite}>{item.capacite} joueurs max</Text>
                )}
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 18, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: radius.sm,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { color: colors.accent, fontFamily: fonts.titleXL, fontSize: 18 },

  chipsRow: { paddingHorizontal: 18, paddingVertical: 12, gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.muted, fontFamily: fonts.ui, fontSize: 13 },
  chipTextActive: { color: colors.bg },

  list: { padding: 18, gap: 14 },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg, overflow: 'hidden',
    borderWidth: 1, borderColor: colors.border,
  },
  img: { width: '100%', height: 160 },
  imgPlaceholder: {
    width: '100%', height: 120,
    backgroundColor: `${colors.accent}12`,
    alignItems: 'center', justifyContent: 'center',
  },
  imgEmoji: { fontSize: 48 },

  info: { padding: 14 },
  infoTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  nom: { color: colors.white, fontFamily: fonts.title, fontSize: 15 },
  sport: { color: colors.muted, fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  prix: { color: colors.accent, fontFamily: fonts.titleXL, fontSize: 15 },
  adresse: { color: colors.muted, fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  capacite: { color: colors.muted, fontFamily: fonts.body, fontSize: 12, marginTop: 4 },

  empty: { paddingVertical: 60, alignItems: 'center' },
  emptyTxt: { color: colors.muted, fontFamily: fonts.body, fontSize: 14 },
});
