import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  Image,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { colors, fonts, radius, TOP_INSET } from '../../theme';
import { IcoBack } from '../../components/icons';
import Avatar from '../../components/Avatar';
import { formatPrice } from '../../utils/format';
import { getTousLesBlocsActifs } from '../../services/aLaUne';
import type { BlocALaUne } from '../../types/aLaUne';

// ─── Icônes ──────────────────────────────────────────────────────────────────

const IcoFlame = () => (
  <Svg width={17} height={17} viewBox="0 0 24 24" fill="none" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" stroke={colors.accent} fill={colors.accent + '30'} />
  </Svg>
);

const IcoEmpty = () => (
  <Svg width={52} height={52} viewBox="0 0 24 24" fill="none" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" stroke={colors.muted} />
  </Svg>
);

// ─── Countdown helper ─────────────────────────────────────────────────────────

function countdown(expireAt: string): string {
  const ms = new Date(expireAt).getTime() - Date.now();
  if (ms <= 0) return 'Expiré';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h > 0) return `${h}h${m.toString().padStart(2, '0')}`;
  return `${m} min`;
}

// ─── Mini-carte bloc (scroll horizontal) ──────────────────────────────────────

interface BlocMiniCardProps {
  bloc: BlocALaUne;
  onPress: () => void;
}

function BlocMiniCard({ bloc, onPress }: BlocMiniCardProps) {
  const firstEl = bloc.elements[0];
  const extraCount = bloc.elements.length - 1;
  const timer = countdown(bloc.expire_at);

  return (
    <TouchableOpacity style={styles.miniCard} onPress={onPress} activeOpacity={0.82}>
      {/* Image si disponible */}
      {bloc.image_url ? (
        <Image source={{ uri: bloc.image_url }} style={styles.miniCardImg} resizeMode="contain" />
      ) : (
        <View style={styles.miniCardImgPlaceholder}>
          <IcoFlame />
        </View>
      )}

      <View style={styles.miniCardBody}>
        {/* Titre */}
        <Text style={styles.miniCardTitre} numberOfLines={1}>{bloc.titre}</Text>

        {/* Premier élément */}
        {firstEl && (
          <View style={styles.miniCardEl}>
            <Text style={styles.miniCardElNom} numberOfLines={1}>{firstEl.nom}</Text>
            {firstEl.prix > 0 && (
              <Text style={styles.miniCardElPrix}>{formatPrice(firstEl.prix)}</Text>
            )}
          </View>
        )}

        {/* Autres éléments */}
        {extraCount > 0 && (
          <Text style={styles.miniCardExtra}>+{extraCount} article{extraCount > 1 ? 's' : ''}</Text>
        )}

        {/* Footer : countdown + CTA */}
        <View style={styles.miniCardFooter}>
          <View style={styles.miniCardTimer}>
            <Text style={styles.miniCardTimerTxt}>⏳ {timer}</Text>
          </View>
        </View>

        <View style={styles.miniCardCTA}>
          <Text style={styles.miniCardCTATxt}>Voir l'offre</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Panneau prestataire ──────────────────────────────────────────────────────

interface PanneauPrestataire {
  prestataireId: string;
  shopName: string;
  shopLogoUrl: string | null;
  blocs: BlocALaUne[];
}

interface PanneauProps {
  panneau: PanneauPrestataire;
  onBlocPress: (bloc: BlocALaUne) => void;
  onShopPress: (shopId: string, shopName: string) => void;
}

function PanneauCard({ panneau, onBlocPress, onShopPress }: PanneauProps) {
  const count = panneau.blocs.length;

  return (
    <View style={styles.panneau}>
      {/* En-tête prestataire */}
      <TouchableOpacity
        style={styles.panneauHeader}
        onPress={() => onShopPress(panneau.prestataireId, panneau.shopName)}
        activeOpacity={0.75}
      >
        <Avatar
          name={panneau.shopName}
          imageUrl={panneau.shopLogoUrl}
          size={42}
          variant="shop"
        />
        <View style={styles.panneauHeaderInfo}>
          <Text style={styles.panneauShopName} numberOfLines={1}>{panneau.shopName}</Text>
          <Text style={styles.panneauBlocCount}>
            {count} offre{count > 1 ? 's' : ''} active{count > 1 ? 's' : ''}
          </Text>
        </View>
        <View style={styles.panneauHeaderBadge}>
          <IcoFlame />
          <Text style={styles.panneauHeaderBadgeTxt}>{count}</Text>
        </View>
      </TouchableOpacity>

      {/* Séparateur */}
      <View style={styles.panneauDivider} />

      {/* Blocs en scroll horizontal */}
      <FlatList
        data={panneau.blocs}
        keyExtractor={b => b.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.miniCardList}
        renderItem={({ item }) => (
          <BlocMiniCard
            bloc={item}
            onPress={() => onBlocPress(item)}
          />
        )}
      />

      {/* Voir toute la boutique */}
      <TouchableOpacity
        style={styles.panneauVoirBoutique}
        onPress={() => onShopPress(panneau.prestataireId, panneau.shopName)}
        activeOpacity={0.75}
      >
        <Text style={styles.panneauVoirBoutiqueTxt}>Voir toute la boutique →</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Écran principal ──────────────────────────────────────────────────────────

interface Props {
  onBack: () => void;
  onBlocPress: (blocCode: string) => void;
  onShopPress: (shopId: string, shopName: string) => void;
}

export default function AlaUneFeedScreen({ onBack, onBlocPress, onShopPress }: Props) {
  const [panneaux, setPanneaux] = useState<PanneauPrestataire[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const blocs = await getTousLesBlocsActifs();

      const map: Record<string, PanneauPrestataire> = {};
      const order: string[] = [];
      for (const b of blocs) {
        if (!map[b.prestataire_id]) {
          map[b.prestataire_id] = {
            prestataireId: b.prestataire_id,
            shopName: b.shop_name ?? 'Boutique',
            shopLogoUrl: b.shop_logo_url ?? null,
            blocs: [],
          };
          order.push(b.prestataire_id);
        }
        map[b.prestataire_id].blocs.push(b);
      }
      setPanneaux(order.map(id => map[id]));
    } catch {
      setPanneaux([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: TOP_INSET }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
          <IcoBack />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <IcoFlame />
          <Text style={styles.headerTitle}>À la une</Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={() => load(true)} activeOpacity={0.7}>
          {refreshing
            ? <ActivityIndicator color={colors.accent} size="small" />
            : <Text style={styles.refreshTxt}>↻</Text>
          }
        </TouchableOpacity>
      </View>

      {/* Sous-titre */}
      <Text style={styles.subtitle}>Offres flash en cours chez vos prestataires</Text>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={styles.loadingTxt}>Chargement des offres…</Text>
        </View>
      ) : panneaux.length === 0 ? (
        <View style={styles.centered}>
          <IcoEmpty />
          <Text style={styles.emptyTitle}>Aucune offre en cours</Text>
          <Text style={styles.emptyTxt}>
            Les prestataires n'ont pas encore publié{'\n'}de blocs À la une aujourd'hui.
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.countInfo}>
            {panneaux.reduce((acc, p) => acc + p.blocs.length, 0)} offre{panneaux.reduce((acc, p) => acc + p.blocs.length, 0) > 1 ? 's' : ''} · {panneaux.length} prestataire{panneaux.length > 1 ? 's' : ''}
          </Text>

          {panneaux.map(p => (
            <PanneauCard
              key={p.prestataireId}
              panneau={p}
              onBlocPress={b => onBlocPress(b.code ?? b.id)}
              onShopPress={onShopPress}
            />
          ))}

          <View style={{ height: 32 }} />
        </ScrollView>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const MINI_CARD_W = 200;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 10,
  },
  backBtn: { padding: 4 },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { color: colors.white, fontFamily: fonts.title, fontSize: 18 },
  refreshBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  refreshTxt: { color: colors.accent, fontSize: 20, lineHeight: 24 },

  subtitle: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 4,
  },

  countInfo: {
    color: colors.muted,
    fontFamily: fonts.ui,
    fontSize: 11.5,
    marginBottom: 16,
  },

  loadingTxt: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
    marginTop: 12,
  },
  emptyTitle: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 16,
    marginTop: 20,
    marginBottom: 8,
  },
  emptyTxt: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16 },

  // ── Panneau prestataire ──────────────────────────────────────────────────
  panneau: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
    overflow: 'hidden',
  },
  panneauHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  panneauHeaderInfo: { flex: 1 },
  panneauShopName: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 15,
  },
  panneauBlocCount: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11.5,
    marginTop: 2,
  },
  panneauHeaderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.accent + '18',
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: colors.accent + '30',
  },
  panneauHeaderBadgeTxt: {
    color: colors.accent,
    fontFamily: fonts.ui,
    fontSize: 13,
  },
  panneauDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: 16,
  },

  miniCardList: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },

  panneauVoirBoutique: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingVertical: 12,
    alignItems: 'center',
  },
  panneauVoirBoutiqueTxt: {
    color: colors.accent,
    fontFamily: fonts.ui,
    fontSize: 12.5,
  },

  // ── Mini-carte bloc ──────────────────────────────────────────────────────
  miniCard: {
    width: MINI_CARD_W,
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  miniCardImg: {
    width: MINI_CARD_W,
    height: 110,
    backgroundColor: colors.surface,
  },
  miniCardImgPlaceholder: {
    width: MINI_CARD_W,
    height: 70,
    backgroundColor: colors.accent + '12',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  miniCardBody: {
    padding: 12,
  },
  miniCardTitre: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 13.5,
    marginBottom: 6,
  },
  miniCardEl: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
  },
  miniCardElNom: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11.5,
    flex: 1,
    marginRight: 6,
  },
  miniCardElPrix: {
    color: colors.accent,
    fontFamily: fonts.ui,
    fontSize: 12,
  },
  miniCardExtra: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 10.5,
    marginBottom: 8,
  },
  miniCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  miniCardTimer: {
    backgroundColor: colors.accent + '18',
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  miniCardTimerTxt: {
    color: colors.accent,
    fontFamily: fonts.ui,
    fontSize: 10.5,
  },
  miniCardCTA: {
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    paddingVertical: 9,
    alignItems: 'center',
  },
  miniCardCTATxt: {
    color: colors.bg,
    fontFamily: fonts.title,
    fontSize: 12.5,
  },
});
