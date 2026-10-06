import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Share,
} from 'react-native';
import { Image } from 'expo-image';
import * as Clipboard from 'expo-clipboard';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts, radius, TOP_INSET } from '../../theme';
import { IcoBack } from '../../components/icons';
import { formatPrice } from '../../utils/format';
import { Terrain, SPORT_EMOJI, SPORT_LABEL } from '../../types/terrain';
import * as terrainsService from '../../services/terrains';
import useAuthStore from '../../store/authStore';
import useShopStore from '../../store/shopStore';
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
  const imgUrl = terrain.images?.[0] ?? null;
  return (
    <View style={styles.card}>
      {imgUrl ? (
        <Image
          source={{ uri: imgUrl }}
          style={styles.cardImg}
          contentFit="cover"
          cachePolicy="disk"
          transition={200}
          placeholder={{ color: '#0d1228' }}
        />
      ) : null}
      <View style={styles.cardTop}>
        {!imgUrl ? (
          <Text style={styles.cardEmoji}>{SPORT_EMOJI[terrain.sport_type]}</Text>
        ) : null}
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
          <Text style={[styles.actionTxt, styles.actionTxtAccent]}>Mes réservations</Text>
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
  onCreneaux: () => void;
}

// ─── Écran ────────────────────────────────────────────────────────────────────

export default function TerrainScreen({ onBack, onAddTerrain, onEditTerrain, onTerrainReservations, onCreneaux }: Props) {
  const prestataireId = useAuthStore(s => s.user?.id ?? '');
  const shopSlug      = useShopStore(s => s.profile?.slug ?? null);
  const shopName      = useShopStore(s => s.profile?.name ?? 'Mon terrain');
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
              <Svg width={44} height={44} viewBox="0 0 24 24" fill="none" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" stroke={colors.accent} />
                <Path d="M4 22v-7" stroke={colors.accent} />
              </Svg>
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

          {shopSlug ? (
            <View style={styles.shareSection}>
              <Text style={styles.shareSectionTitle}>Mon lien de réservation</Text>
              <View style={styles.shareCard}>
                <Text style={styles.shareLink} numberOfLines={1}>{`s.lassi.tech/${shopSlug}`}</Text>
                <Text style={styles.shareHint}>
                  Partagez ce lien à vos clients pour qu'ils réservent un créneau directement sur votre terrain.
                </Text>
                <View style={styles.shareRow}>
                  <TouchableOpacity
                    style={[styles.shareBtn, styles.shareBtnGhost]}
                    onPress={async () => {
                      await Clipboard.setStringAsync(`https://s.lassi.tech/${shopSlug}`);
                      Alert.alert('Copié', 'Lien copié dans le presse-papier.');
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.shareBtnGhostTxt}>Copier</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.shareBtn, styles.shareBtnSolid]}
                    onPress={() =>
                      Share.share({
                        message: `Réservez un terrain sur ${shopName} ! 🏟️\nDisponibilités et paiement ici : https://s.lassi.tech/${shopSlug}`,
                      }).catch(() => {})
                    }
                    activeOpacity={0.8}
                  >
                    <Text style={styles.shareBtnSolidTxt}>Partager</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ) : null}

          <TouchableOpacity
            style={styles.creneauxBtn}
            onPress={onCreneaux}
            activeOpacity={0.85}
          >
            <Text style={styles.creneauxBtnTxt}>Définir mes créneaux</Text>
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
  cardImg: { width: '100%', height: 140 },
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
  emptyIco: { marginBottom: 6 },
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

  shareSection: { marginTop: 24 },
  shareSectionTitle: {
    color: colors.white, fontFamily: fonts.title, fontSize: 14,
    marginBottom: 10,
  },
  shareCard: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, padding: 16,
  },
  shareLink: {
    color: colors.accent, fontFamily: fonts.titleXL, fontSize: 15,
    marginBottom: 6,
  },
  shareHint: {
    color: colors.muted, fontFamily: fonts.body, fontSize: 12,
    lineHeight: 17, marginBottom: 14,
  },
  shareRow: { flexDirection: 'row', gap: 10 },
  shareBtn: {
    flex: 1, height: 42, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  shareBtnGhost: { borderWidth: 1, borderColor: colors.border },
  shareBtnGhostTxt: { color: colors.white, fontFamily: fonts.ui, fontSize: 13 },
  shareBtnSolid: { backgroundColor: colors.accent },
  shareBtnSolidTxt: { color: colors.bg, fontFamily: fonts.ui, fontSize: 13, fontWeight: '700' },

  creneauxBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: `${colors.accent}18`, borderWidth: 1, borderColor: colors.accent,
    borderRadius: radius.lg, height: 50, marginTop: 12,
  },
  creneauxBtnTxt: { color: colors.accent, fontFamily: fonts.title, fontSize: 15 },
});
