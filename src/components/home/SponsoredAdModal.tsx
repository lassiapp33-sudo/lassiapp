import React, { useEffect, useState } from 'react';
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
// Largeur interne de la carte : overlay padding 20×2, border 1.5×2
const CARD_IMG_W = Math.min(SCREEN_W - 40, 380) - 3;

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
  const [imgRatio, setImgRatio] = useState<number | null>(null);

  useEffect(() => {
    incrementerVue(ad.id);
  }, [ad.id]);

  // Image.getSize en premier (avant render), onLoad en backup
  useEffect(() => {
    if (ad.imageUrl) {
      Image.getSize(
        ad.imageUrl,
        (w, h) => { if (w > 0 && h > 0) setImgRatio(w / h); },
        () => {}, // onLoad prendra le relais
      );
    }
  }, [ad.imageUrl]);

  const hasText = !!(ad.titre || ad.corps);
  // Hauteur calculée selon le ratio réel — par défaut carré jusqu'au chargement
  const imgHeight = imgRatio != null ? Math.round(CARD_IMG_W / imgRatio) : CARD_IMG_W;

  return (
    <Modal visible animationType="fade" transparent presentationStyle="overFullScreen" onRequestClose={onDismiss}>
      <View style={s.overlay}>
        <View style={s.card}>

          {/* Bouton X fermer */}
          <TouchableOpacity
            style={s.closeBtn}
            onPress={onDismiss}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
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
                size={36}
                variant="shop"
              />
              <Text style={s.shopName} numberOfLines={1}>{ad.shopName}</Text>
            </View>

            {/* Image — hauteur exacte selon dimensions réelles, aucun crop */}
            {ad.imageUrl ? (
              <Image
                source={{ uri: ad.imageUrl }}
                style={{ width: '100%', height: imgHeight }}
                resizeMode="cover"
                onLoad={e => {
                  const { width, height } = e.nativeEvent.source;
                  if (width > 0 && height > 0) setImgRatio(width / height);
                }}
              />
            ) : null}

            {/* Texte (annonce classique) */}
            {hasText ? (
              <View style={[s.textBody, !ad.imageUrl && s.textBodyNoImage]}>
                {ad.titre ? <Text style={s.titre}>{ad.titre}</Text> : null}
                {ad.corps ? <Text style={s.corps}>{ad.corps}</Text> : null}
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
    maxHeight: SCREEN_H * 0.88,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.accent + '55',
    borderRadius: radius.xl,
    overflow: 'hidden',
  },

  // Bouton fermer
  closeBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
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
    paddingTop: 8,
    paddingBottom: 2,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.accent + '18',
    borderWidth: 1,
    borderColor: colors.accent + '55',
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 3,
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
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 5,
    paddingBottom: 7,
  },
  shopName: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 13,
    flexShrink: 1,
  },

  // Texte
  textBody: {
    paddingHorizontal: 22,
    paddingTop: 12,
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
    padding: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  btnPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    height: 40,
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
    height: 40,
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

