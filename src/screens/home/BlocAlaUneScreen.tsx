import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { colors, fonts, radius, TOP_INSET } from '../../theme';
import { IcoBack } from '../../components/icons';
import Avatar from '../../components/Avatar';
import { formatPrice } from '../../utils/format';
import { supabase } from '../../lib/supabase';
import type { BlocALaUne } from '../../types/aLaUne';

// ─── Types locaux ─────────────────────────────────────────────────────────────

interface ShopInfo {
  id: string;
  name: string;
  logoUrl: string | null;
}

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

// ─── Carte élément ────────────────────────────────────────────────────────────

interface ElCardProps {
  el: BlocALaUne['elements'][number];
  highlighted: boolean;
  onShop: () => void;
}

function ElCard({ el, highlighted, onShop }: ElCardProps) {
  return (
    <View style={[styles.elCard, highlighted && styles.elCardHighlight]}>
      {highlighted && <Text style={styles.elHighlightBadge}>👋 Ce produit t'a été recommandé</Text>}
      <Text style={styles.elNom}>{el.nom}</Text>
      <Text style={styles.elPrix}>{formatPrice(el.prix)}</Text>
      <TouchableOpacity style={styles.shopBtn} onPress={onShop} activeOpacity={0.8}>
        <Text style={styles.shopBtnTxt}>Voir la boutique</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Écran ────────────────────────────────────────────────────────────────────

interface Props {
  blocId: string;
  produitId?: string;
  onBack: () => void;
  onShopPress: (shopId: string, shopName: string) => void;
}

export default function BlocAlaUneScreen({ blocId, produitId, onBack, onShopPress }: Props) {
  const [bloc, setBloc] = useState<BlocALaUne | null>(null);
  const [shop, setShop] = useState<ShopInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const countdown = useCountdown(bloc?.expire_at ?? new Date(Date.now() + 3600000).toISOString());
  const flatRef = useRef<FlatList>(null);

  useEffect(() => {
    (async () => {
      const { data: blocData } = await supabase
        .from('a_la_une')
        .select('*')
        .eq('id', blocId)
        .single();

      if (!blocData) { setLoading(false); return; }
      setBloc(blocData as BlocALaUne);

      const { data: shopData } = await supabase
        .from('shops')
        .select('id, name, logo_url')
        .eq('merchant_id', blocData.prestataire_id)
        .maybeSingle();

      if (shopData) {
        setShop({ id: shopData.id, name: shopData.name, logoUrl: shopData.logo_url ?? null });
      }
      setLoading(false);
    })();
  }, [blocId]);

  // Scroll vers l'élément ciblé une fois les données chargées
  useEffect(() => {
    if (!produitId || !bloc?.elements) return;
    const idx = bloc.elements.findIndex(e => e.id === produitId);
    if (idx > 0) {
      const timer = setTimeout(() => {
        flatRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.2 });
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [produitId, bloc]);

  if (loading) {
    return (
      <View style={styles.root}>
        <View style={[styles.header, { paddingTop: TOP_INSET }]}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
            <IcoBack />
          </TouchableOpacity>
        </View>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      </View>
    );
  }

  if (!bloc) {
    return (
      <View style={styles.root}>
        <View style={[styles.header, { paddingTop: TOP_INSET }]}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
            <IcoBack />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>À la une</Text>
        </View>
        <View style={styles.centered}>
          <Text style={styles.notFoundTxt}>Ce bloc n'est plus disponible.</Text>
          <TouchableOpacity onPress={onBack} style={styles.retourBtn}>
            <Text style={styles.retourTxt}>Retour</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const isExpire = new Date(bloc.expire_at).getTime() <= Date.now();

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: TOP_INSET }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
          <IcoBack />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          {shop && (
            <Avatar
              name={shop.name}
              imageUrl={shop.logoUrl}
              size={30}
              variant="shop"
            />
          )}
          <View>
            {shop && <Text style={styles.shopNameHeader} numberOfLines={1}>{shop.name}</Text>}
            <Text style={styles.headerTitle} numberOfLines={1}>{bloc.titre}</Text>
          </View>
        </View>
        {!isExpire && (
          <View style={styles.countdownPill}>
            <Text style={styles.countdownTxt}>⏳ {countdown}</Text>
          </View>
        )}
        {isExpire && (
          <View style={[styles.countdownPill, styles.expiredPill]}>
            <Text style={[styles.countdownTxt, { color: colors.danger }]}>Expiré</Text>
          </View>
        )}
      </View>

      {/* Description */}
      {bloc.description ? (
        <View style={styles.descBox}>
          <Text style={styles.descTxt}>{bloc.description}</Text>
        </View>
      ) : null}

      {/* Éléments */}
      <FlatList
        ref={flatRef}
        data={bloc.elements}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        onScrollToIndexFailed={() => {}}
        renderItem={({ item }) => (
          <ElCard
            el={item}
            highlighted={item.id === produitId}
            onShop={() => shop && onShopPress(shop.id, shop.name)}
          />
        )}
        ListFooterComponent={
          shop ? (
            <TouchableOpacity
              style={styles.voirBoutiqueGlobal}
              onPress={() => onShopPress(shop.id, shop.name)}
              activeOpacity={0.8}
            >
              <Text style={styles.voirBoutiqueTxt}>Voir toute la boutique de {shop.name}</Text>
            </TouchableOpacity>
          ) : null
        }
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 10,
  },
  backBtn: { padding: 4 },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  shopNameHeader: { color: colors.muted, fontFamily: fonts.body, fontSize: 10.5 },
  headerTitle: { color: colors.white, fontFamily: fonts.title, fontSize: 15 },
  countdownPill: {
    backgroundColor: colors.accent + '22',
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  expiredPill: { backgroundColor: colors.danger + '18' },
  countdownTxt: { color: colors.accent, fontFamily: fonts.ui, fontSize: 11 },

  descBox: {
    marginHorizontal: 20,
    marginTop: 14,
    marginBottom: 4,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 12,
  },
  descTxt: { color: colors.muted, fontFamily: fonts.body, fontSize: 13, lineHeight: 20 },

  list: { padding: 20, gap: 12 },

  elCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 16,
  },
  elCardHighlight: {
    borderColor: colors.accent,
    borderWidth: 1.5,
    backgroundColor: colors.surface,
  },
  elHighlightBadge: {
    color: colors.accent,
    fontFamily: fonts.body,
    fontSize: 11,
    marginBottom: 8,
  },
  elNom: { color: colors.white, fontFamily: fonts.title, fontSize: 17, marginBottom: 4 },
  elPrix: { color: colors.accent, fontFamily: fonts.ui, fontSize: 16, marginBottom: 14 },

  shopBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 11,
    alignItems: 'center',
  },
  shopBtnTxt: { color: colors.bg, fontFamily: fonts.title, fontSize: 14 },

  voirBoutiqueGlobal: {
    marginTop: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 20,
  },
  voirBoutiqueTxt: { color: colors.muted, fontFamily: fonts.ui, fontSize: 13 },

  notFoundTxt: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  retourBtn: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  retourTxt: { color: colors.white, fontFamily: fonts.ui, fontSize: 14 },
});
