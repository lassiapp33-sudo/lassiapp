import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Platform,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts, radius, TOP_INSET } from '../../theme';
import { IcoBack } from '../../components/icons';
import { formatPrice } from '../../utils/format';
import { Terrain, SPORT_EMOJI, SPORT_LABEL } from '../../types/terrain';
import * as terrainsService from '../../services/terrains';
import useAuthStore from '../../store/authStore';
import logger from '../../utils/logger';

// ─── Icônes ───────────────────────────────────────────────────────────────────

const IcoPlus = () => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" strokeWidth={2} strokeLinecap="round">
    <Path d="M12 5v14M5 12h14" stroke={colors.bg} />
  </Svg>
);

const IcoPencil = () => (
  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" strokeWidth={1.8} strokeLinecap="round">
    <Path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke={colors.muted} />
    <Path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke={colors.muted} />
  </Svg>
);

const IcoCal = () => (
  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" strokeWidth={1.8} strokeLinecap="round">
    <Path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" stroke={colors.accent} />
  </Svg>
);

// ─── Carte terrain ────────────────────────────────────────────────────────────

function TerrainCard({
  terrain,
  onEdit,
  onReservations,
}: {
  terrain: Terrain;
  onEdit: () => void;
  onReservations: () => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <Text style={styles.cardEmoji}>{SPORT_EMOJI[terrain.sport_type]}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardNom}>{terrain.nom}</Text>
          <Text style={styles.cardSport}>{SPORT_LABEL[terrain.sport_type]}</Text>
          {terrain.adresse ? (
            <Text style={styles.cardAdresse} numberOfLines={1}>{terrain.adresse}</Text>
          ) : null}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.cardPrix}>{formatPrice(terrain.prix_horaire)}</Text>
          <Text style={styles.cardPrixSub}>/ h</Text>
        </View>
      </View>

      <View style={styles.cardActions}>
        <TouchableOpacity style={styles.actionBtn} onPress={onEdit} activeOpacity={0.8}>
          <IcoPencil />
          <Text style={styles.actionTxt}>Modifier</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, styles.actionBtnAccent]} onPress={onReservations} activeOpacity={0.8}>
          <IcoCal />
          <Text style={[styles.actionTxt, styles.actionTxtAccent]}>Réservations</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  onBack: () => void;
  onAddTerrain: () => void;
  onEditTerrain: (terrain: Terrain) => void;
  onTerrainReservations: (terrain: Terrain) => void;
}

// ─── Écran ────────────────────────────────────────────────────────────────────

export default function TerrainScreen({ onBack, onAddTerrain, onEditTerrain, onTerrainReservations }: Props) {
  const prestataireId = useAuthStore(s => s.user?.id ?? '');
  const [terrains, setTerrains] = useState<Terrain[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTerrains = useCallback(async () => {
    if (!prestataireId) return;
    setLoading(true);
    try {
      const ts = await terrainsService.getTerrainsByMerchant(prestataireId);
      setTerrains(ts);
    } catch (err) {
      logger.warn('[TerrainScreen] load:', err);
    } finally {
      setLoading(false);
    }
  }, [prestataireId]);

  useEffect(() => { loadTerrains(); }, [loadTerrains]);

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: TOP_INSET + 4 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.8}>
          <IcoBack />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mes terrains</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {terrains.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyEmoji}>🏟️</Text>
              <Text style={styles.emptyTitle}>Aucun terrain</Text>
              <Text style={styles.emptySub}>
                Ajoute ton premier terrain pour commencer à recevoir des réservations.
              </Text>
            </View>
          ) : (
            terrains.map(t => (
              <TerrainCard
                key={t.id}
                terrain={t}
                onEdit={() => onEditTerrain(t)}
                onReservations={() => onTerrainReservations(t)}
              />
            ))
          )}

          <TouchableOpacity
            style={styles.addBtn}
            onPress={onAddTerrain}
            activeOpacity={0.85}
          >
            <IcoPlus />
            <Text style={styles.addTxt}>Ajouter un terrain</Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  content: { padding: 18 },

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
  headerTitle: { color: colors.white, fontFamily: fonts.title, fontSize: 17, flex: 1 },

  card: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, marginBottom: 12, overflow: 'hidden',
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14 },
  cardEmoji: { fontSize: 28 },
  cardNom: { color: colors.white, fontFamily: fonts.title, fontSize: 15 },
  cardSport: { color: colors.muted, fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  cardAdresse: { color: colors.muted, fontFamily: fonts.body, fontSize: 11, marginTop: 2 },
  cardPrix: { color: colors.accent, fontFamily: fonts.titleXL, fontSize: 16 },
  cardPrixSub: { color: colors.muted, fontFamily: fonts.body, fontSize: 11 },

  cardActions: {
    flexDirection: 'row',
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12,
  },
  actionBtnAccent: {
    borderLeftWidth: 1, borderLeftColor: colors.border,
    backgroundColor: `${colors.accent}08`,
  },
  actionTxt: { color: colors.muted, fontFamily: fonts.ui, fontSize: 13 },
  actionTxtAccent: { color: colors.accent },

  emptyBox: { alignItems: 'center', paddingVertical: 60, gap: 10 },
  emptyEmoji: { fontSize: 44 },
  emptyTitle: { color: colors.white, fontFamily: fonts.title, fontSize: 17 },
  emptySub: {
    color: colors.muted, fontFamily: fonts.body,
    fontSize: 13, textAlign: 'center', lineHeight: 20,
  },

  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: colors.accent, borderRadius: radius.lg,
    height: 50, marginTop: 8,
  },
  addTxt: { color: colors.bg, fontFamily: fonts.title, fontSize: 14 },
});
