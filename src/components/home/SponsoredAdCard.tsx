import React, { useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { colors, fonts, radius } from '../../theme';
import { SponsoredAd, incrementerVue } from '../../services/sponsoredAds';

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_H = Math.round(SCREEN_W * 0.56); // ratio ~16:9 pour Format A
const AFFICHE_H = Math.round(SCREEN_W * 1.15); // ratio portrait pour Format B

// ─── Icônes ───────────────────────────────────────────────────────────────────

const IcoChat = () => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke={colors.bg} />
  </Svg>
);

const IcoStore = () => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M3 9l1-5h16l1 5M4 9v11a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9M3 9h18" stroke={colors.accent} />
  </Svg>
);

const IcoDot = () => (
  <Svg width={6} height={6} viewBox="0 0 6 6">
    <Circle cx={3} cy={3} r={3} fill={colors.accent} />
  </Svg>
);

// ─── En-tête boutique ─────────────────────────────────────────────────────────

function ShopHeader({
  name,
  category,
  logoUrl,
}: {
  name: string;
  category: string;
  logoUrl: string | null | undefined;
}) {
  return (
    <View style={s.shopHeader}>
      <View style={s.logoWrap}>
        {logoUrl ? (
          <Image source={{ uri: logoUrl }} style={s.logo} />
        ) : (
          <View style={s.logoFallback}>
            <Text style={s.logoInitial}>{name.charAt(0).toUpperCase()}</Text>
          </View>
        )}
      </View>
      <View style={s.shopInfo}>
        <Text style={s.shopName} numberOfLines={1}>{name}</Text>
        <View style={s.sponsoredRow}>
          <IcoDot />
          <Text style={s.sponsoredTxt}>Sponsorisé</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Boutons double CTA ───────────────────────────────────────────────────────

function ActionButtons({
  onContact,
  onViewShop,
}: {
  onContact: () => void;
  onViewShop: () => void;
}) {
  return (
    <View style={s.actions}>
      <TouchableOpacity style={s.btnPrimary} onPress={onContact} activeOpacity={0.85}>
        <IcoChat />
        <Text style={s.btnPrimaryTxt}>Contacter</Text>
      </TouchableOpacity>
      <TouchableOpacity style={s.btnSecondary} onPress={onViewShop} activeOpacity={0.85}>
        <IcoStore />
        <Text style={s.btnSecondaryTxt}>Voir la vitrine</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Format A — Classique ─────────────────────────────────────────────────────

function ClassiqueCard({
  ad,
  onContact,
  onViewShop,
}: {
  ad: SponsoredAd;
  onContact: () => void;
  onViewShop: () => void;
}) {
  return (
    <View style={s.card}>
      <ShopHeader name={ad.shopName ?? ''} category={ad.shopCategory ?? ''} logoUrl={ad.shopLogoUrl} />

      {ad.imageUrl && (
        <Image source={{ uri: ad.imageUrl }} style={[s.adImage, { height: CARD_H }]} resizeMode="cover" />
      )}

      <View style={s.textBody}>
        {ad.titre && <Text style={s.titre}>{ad.titre}</Text>}
        {ad.corps && <Text style={s.corps} numberOfLines={3}>{ad.corps}</Text>}
      </View>

      <ActionButtons onContact={onContact} onViewShop={onViewShop} />
    </View>
  );
}

// ─── Format B — Affiche ───────────────────────────────────────────────────────

function AfficheCard({
  ad,
  onContact,
  onViewShop,
}: {
  ad: SponsoredAd;
  onContact: () => void;
  onViewShop: () => void;
}) {
  return (
    <View style={s.card}>
      <View style={[s.afficheWrap, { height: AFFICHE_H }]}>
        {ad.imageUrl ? (
          <Image source={{ uri: ad.imageUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.surface }]} />
        )}
        {/* Gradient overlay */}
        <View style={s.afficheOverlay} />
        <View style={s.afficheHeader}>
          <ShopHeader name={ad.shopName ?? ''} category={ad.shopCategory ?? ''} logoUrl={ad.shopLogoUrl} />
        </View>
        <View style={s.afficheFooter}>
          <ActionButtons onContact={onContact} onViewShop={onViewShop} />
        </View>
      </View>
    </View>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

interface Props {
  ad: SponsoredAd;
  onContact: () => void;
  onViewShop: () => void;
}

export default function SponsoredAdCard({ ad, onContact, onViewShop }: Props) {
  useEffect(() => {
    incrementerVue(ad.id);
  }, [ad.id]);

  if (ad.format === 'affiche') {
    return <AfficheCard ad={ad} onContact={onContact} onViewShop={onViewShop} />;
  }
  return <ClassiqueCard ad={ad} onContact={onContact} onViewShop={onViewShop} />;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    overflow: 'hidden',
    marginHorizontal: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },

  // En-tête boutique
  shopHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 10,
  },
  logoWrap: { width: 38, height: 38 },
  logo: { width: 38, height: 38, borderRadius: 10 },
  logoFallback: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoInitial: {
    color: colors.bg,
    fontFamily: fonts.titleXL,
    fontSize: 16,
  },
  shopInfo: { flex: 1 },
  shopName: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 14,
  },
  sponsoredRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  sponsoredTxt: {
    color: colors.accent,
    fontFamily: fonts.body,
    fontSize: 11,
  },

  // Image Format A
  adImage: {
    width: '100%',
    borderRadius: 0,
  },

  // Texte Format A
  textBody: { padding: 14, paddingBottom: 4 },
  titre: {
    color: colors.white,
    fontFamily: fonts.titleXL,
    fontSize: 16,
    marginBottom: 6,
  },
  corps: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
  },

  // Boutons d'action
  actions: {
    flexDirection: 'row',
    gap: 10,
    padding: 12,
  },
  btnPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
  },
  btnPrimaryTxt: {
    color: colors.bg,
    fontFamily: fonts.titleXL,
    fontSize: 14,
  },
  btnSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.accent,
    backgroundColor: 'transparent',
  },
  btnSecondaryTxt: {
    color: colors.accent,
    fontFamily: fonts.title,
    fontSize: 13.5,
  },

  // Format B — Affiche
  afficheWrap: {
    width: '100%',
    position: 'relative',
  },
  afficheOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(20,21,42,0.45)',
  },
  afficheHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  afficheFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 8,
    paddingHorizontal: 2,
    backgroundColor: 'rgba(20,21,42,0.7)',
  },
});
