import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { colors, fonts, radius, TOP_INSET } from '../../theme';
import * as shopsService from '../../services/shops';
import { Shop } from '../../services/shops';
import { computeStatus, type WeekHours } from '../../services/hours';
import { useRealtimeShops } from '../../hooks/useRealtimeShops';
import Avatar from '../../components/Avatar';
import { useT } from '../../i18n';
import { LassiMascotte, MASCOTTE_NOM } from '../../components/LassiMascotte';
import Svg, { Path } from 'react-native-svg';
import { IcoBack, IcoSearch } from '../../components/icons';

// ─── Icônes ──────────────────────────────────────────────────────────────────

const IcoStar = () => (
  <Svg
    width={10}
    height={10}
    viewBox="0 0 24 24"
    fill={colors.accent}
    stroke={colors.accent}
    strokeWidth={1}
  >
    <Path d="M12 2 15 9 22 9 16 14 18 21 12 17 6 21 8 14 2 9 9 9z" />
  </Svg>
);

// ─── Sous-composants ──────────────────────────────────────────────────────────

function GroupLabel({ emoji, label, vip }: { emoji: string; label: string; vip?: boolean }) {
  return (
    <Text style={[styles.groupLbl, vip && styles.groupLblVip]}>
      {emoji} {label}
    </Text>
  );
}

function ResultCard({ shop, onPress }: { shop: Shop; onPress: () => void }) {
  const t = useT();
  const { isOpen } = computeStatus(
    shop.openingHours as WeekHours | null,
    shop.isManuallyClose ?? false,
  );
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      {/* Logo boutique — Avatar unique, source de vérité shops.logo_url */}
      <Avatar imageUrl={shop.logoUrl} name={shop.name} size={46} variant="shop" />

      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {shop.name}
          </Text>
          {shop.isVip && (
            <View style={styles.tagVip}>
              <Text style={styles.tagVipTxt}>VIP</Text>
            </View>
          )}
        </View>
        <View style={styles.metaRow}>
          {shop.rating > 0 && (
            <View style={{ marginRight: 3 }}>
              <IcoStar />
            </View>
          )}
          <Text style={styles.meta}>
            {shop.rating > 0 ? `${shop.rating} · ` : ''}
            {isOpen ? t.common.open : t.common.closed} · {shop.zone}
          </Text>
        </View>
      </View>

      <Text style={[styles.status, isOpen ? styles.statusOpen : styles.statusClosed]}>
        {isOpen ? t.common.open : t.common.closed}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Écran ────────────────────────────────────────────────────────────────────

interface Props {
  initialQuery?: string;
  onBack: () => void;
  onShopPress: (shopId: string, shopName: string) => void;
}

export default function SearchScreen({ initialQuery = '', onBack, onShopPress }: Props) {
  const t = useT();

  const [query, setQuery] = useState(initialQuery);
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    shopsService
      .getShops()
      .then(setShops)
      .catch(() => setShops([]))
      .finally(() => setLoading(false));
  }, []);

  // Mise à jour temps réel quand un commerce change ses horaires ou son statut
  useRealtimeShops(updated => {
    setShops(prev => prev.map(s => (s.id === updated.id ? updated : s)));
  });

  const q = query.trim().toLowerCase();
  const filtered = q
    ? shops.filter(s => s.name.toLowerCase().includes(q) || s.zone.toLowerCase().includes(q))
    : shops;

  const vipShops = filtered.filter(s => s.isVip);
  const otherShops = filtered.filter(s => !s.isVip);
  const hasResults = filtered.length > 0;

  return (
    <View style={styles.root}>
      {/* En-tête */}
      <View style={[styles.head, { paddingTop: TOP_INSET + 4 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.75}>
          <IcoBack />
        </TouchableOpacity>
        <Text style={styles.headTitle}>{t.home.searchTitle}</Text>
      </View>

      {/* Barre de recherche active */}
      <View style={styles.searchBar}>
        <IcoSearch />
        <TextInput
          style={styles.input}
          placeholder={t.home.searchPlaceholder}
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
        {loading && (
          <View style={styles.centered}>
            <LassiMascotte forme="search" taille={100} glow={false} />
            <Text style={styles.searchingTxt}>{`${MASCOTTE_NOM} cherche pour toi...`}</Text>
          </View>
        )}

        {!loading && q && !hasResults && (
          <View style={styles.empty}>
            <Text style={styles.emptyTxt}>{t.home.noResults}</Text>
          </View>
        )}

        {!loading && !q && !hasResults && (
          <View style={styles.empty}>
            <Text style={styles.emptyTxt}>{t.home.noShops}</Text>
          </View>
        )}

        {vipShops.length > 0 && (
          <>
            <GroupLabel emoji="🏆" label={`Top VIP`} vip />
            {vipShops.map(s => (
              <ResultCard key={s.id} shop={s} onPress={() => onShopPress(s.id, s.name)} />
            ))}
          </>
        )}

        {otherShops.length > 0 && (
          <>
            <GroupLabel
              emoji="📍"
              label={q ? t.home.allResults.replace('📋 ', '') : t.home.nearby.replace('📍 ', '')}
            />
            {otherShops.map(s => (
              <ResultCard key={s.id} shop={s} onPress={() => onShopPress(s.id, s.name)} />
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },

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

  status: {
    fontFamily: fonts.ui,
    fontSize: 11,
    flexShrink: 0,
  },
  statusOpen: { color: colors.success },
  statusClosed: { color: colors.danger },

  centered: { paddingVertical: 32, alignItems: 'center' },
  searchingTxt: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
    marginTop: 8,
  },
  empty: { paddingVertical: 48, alignItems: 'center' },
  emptyTxt: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 14,
  },
});
