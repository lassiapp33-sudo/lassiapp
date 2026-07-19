import React, { useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Dimensions,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { colors, fonts, radius } from '../../theme';
import Avatar from '../Avatar';
import { SponsoredAd, incrementerVue, incrementerContact } from '../../services/sponsoredAds';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const IMG_H = Math.round(SCREEN_W * 0.52);

// ─── Icônes ───────────────────────────────────────────────────────────────────

const IcoClose = () => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" strokeWidth={2.5} strokeLinecap="round">
    <Path d="M18 6 6 18M6 6l12 12" stroke={colors.muted} />
  </Svg>
);

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
  <Svg width={5} height={5} viewBox="0 0 6 6">
    <Circle cx={3} cy={3} r={3} fill={colors.accent} />
  </Svg>
);

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  ad: SponsoredAd;
  onDismiss: () => void;
  onContact: () => void;
  onViewShop: () => void;
}

// ─── Composant ────────────────────────────────────────────────────────────────

export default function SponsoredAdModal({ ad, onDismiss, onContact, onViewShop }: Props) {
  // Impression : comptabilisée dès que la modale s'affiche
  useEffect(() => {
    incrementerVue(ad.id);
  }, [ad.id]);

  const hasText = !!(ad.titre || ad.corps);

  return (
    <Modal visible animationType="fade" transparent onRequestClose={onDismiss}>
      <View style={s.overlay}>
        <View style={s.card}>

          {/* Bouton X fermer */}
          <TouchableOpacity style={s.closeBtn} onPress={onDismiss} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <IcoClose />
          </TouchableOpacity>

          <ScrollView
            showsVerticalScrollIndicator={false}
            bounces={false}
            contentContainerStyle={s.scrollContent}
          >
            {/* Badge Sponsorisé */}
            <View style={s.badgeRow}>
              <View style={s.badge}>
                <IcoDot />
                <Text style={s.badgeTxt}>SPONSORISÉ</Text>
              </View>
            </View>

            {/* Boutique */}
            <View style={s.shopRow}>
              <Avatar
                imageUrl={ad.shopLogoUrl}
                name={ad.shopName ?? ''}
                size={44}
                variant="shop"
              />
              <Text style={s.shopName} numberOfLines={1}>{ad.shopName}</Text>
            </View>

            {/* Image grande */}
            {ad.imageUrl ? (
              <Image
                source={{ uri: ad.imageUrl }}
                style={[s.image, { height: IMG_H }]}
                resizeMode="cover"
              />
            ) : null}

            {/* Texte */}
            {hasText ? (
              <View style={[s.textBody, !ad.imageUrl && s.textBodyNoImage]}>
                {ad.titre ? (
                  <Text style={s.titre}>{ad.titre}</Text>
                ) : null}
                {ad.corps ? (
                  <Text style={s.corps}>{ad.corps}</Text>
                ) : null}
              </View>
            ) : null}
          </ScrollView>

          {/* Boutons fixes en bas */}
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

        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    maxHeight: SCREEN_H * 0.82,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.accent + '55',
    borderRadius: radius.xl,
    overflow: 'hidden',
  },

  // Bouton fermer
  closeBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.bg + 'CC',
    alignItems: 'center',
    justifyContent: 'center',
  },

  scrollContent: {
    paddingBottom: 4,
  },

  // Badge
  badgeRow: {
    alignItems: 'center',
    paddingTop: 22,
    paddingBottom: 6,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.accent + '18',
    borderWidth: 1,
    borderColor: colors.accent + '55',
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  badgeTxt: {
    color: colors.accent,
    fontFamily: fonts.title,
    fontSize: 10,
    letterSpacing: 0.8,
  },

  // Boutique
  shopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 16,
  },
  shopName: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 16,
    flexShrink: 1,
  },

  // Image
  image: {
    width: '100%',
  },

  // Texte
  textBody: {
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 8,
    alignItems: 'center',
  },
  textBodyNoImage: {
    paddingTop: 8,
  },
  titre: {
    color: colors.white,
    fontFamily: fonts.titleXL,
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 10,
    lineHeight: 26,
  },
  corps: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13.5,
    textAlign: 'center',
    lineHeight: 21,
  },

  // Boutons fixes en bas
  actions: {
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  btnPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    height: 48,
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
    height: 48,
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
});
