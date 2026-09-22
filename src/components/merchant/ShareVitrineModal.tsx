import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Share,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import Svg, { Path, Circle } from 'react-native-svg';
import { colors, fonts, radius } from '../../theme';

// ─── Icônes ───────────────────────────────────────────────────────────────────

const IcoShare = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Circle cx={18} cy={5} r={3} stroke={colors.bg} />
    <Circle cx={6} cy={12} r={3} stroke={colors.bg} />
    <Circle cx={18} cy={19} r={3} stroke={colors.bg} />
    <Path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" stroke={colors.bg} />
  </Svg>
);

const IcoCopy = ({ color }: { color: string }) => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M9 9h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V11a2 2 0 0 1 2-2z" stroke={color} />
    <Path d="M5 15H4a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v1" stroke={color} />
  </Svg>
);

// ─── Composant ────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  slug: string;
  shopName: string;
  onClose: () => void;
}

/**
 * Rappel « Partagez votre vitrine » — modal in-app (lundi/jeudi).
 * Deux actions réelles : Partager (Share natif) et Copier le lien (presse-papier).
 */
export default function ShareVitrineModal({ visible, slug, shopName, onClose }: Props) {
  const [copied, setCopied] = useState(false);
  const url = `https://s.lassi.tech/${slug}`;
  const message = `${shopName} est sur LASSİ ! 🎉\nEntrez directement dans ma boutique et commandez ici : ${url}`;

  const handleCopy = async () => {
    try {
      await Clipboard.setStringAsync(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* silencieux */ }
  };

  const handleShare = async () => {
    try {
      await Share.share({ message });
    } catch { /* annulé / silencieux */ }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
    >
      <View style={s.overlay}>
        <View style={s.card}>
          <View style={s.tagPill}>
            <Text style={s.tagTxt}>VITRINE</Text>
          </View>

          <Text style={s.title}>Faites venir plus de clients</Text>

          <Text style={s.body}>
            Partagez le lien de votre vitrine à vos proches et clients sur
            WhatsApp, TikTok, Facebook… pour qu'ils entrent directement dans
            votre boutique et passent commande.
          </Text>

          <View style={s.linkBox}>
            <Text style={s.linkTxt} numberOfLines={1}>s.lassi.tech/{slug}</Text>
          </View>

          <TouchableOpacity style={s.cta} onPress={handleShare} activeOpacity={0.85}>
            <IcoShare />
            <Text style={s.ctaTxt}>Partager</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.ctaSecondary} onPress={handleCopy} activeOpacity={0.85}>
            <IcoCopy color={colors.accent} />
            <Text style={s.ctaSecondaryTxt}>{copied ? 'Lien copié ✓' : 'Copier le lien'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.later} onPress={onClose} activeOpacity={0.7}>
            <Text style={s.laterTxt}>Plus tard</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.accent,
    borderRadius: radius.xl,
    padding: 22,
    alignItems: 'center',
    gap: 6,
  },
  tagPill: {
    backgroundColor: 'rgba(253,207,52,.15)',
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 5,
    marginBottom: 8,
  },
  tagTxt: {
    color: colors.accent,
    fontFamily: fonts.ui,
    fontSize: 11,
    letterSpacing: 0.8,
  },
  title: {
    color: colors.white,
    fontFamily: fonts.titleXL,
    fontSize: 18,
    textAlign: 'center',
    lineHeight: 24,
  },
  body: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 4,
    marginBottom: 8,
  },
  linkBox: {
    width: '100%',
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 6,
  },
  linkTxt: {
    color: colors.accent,
    fontFamily: fonts.title,
    fontSize: 13,
    textAlign: 'center',
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    height: 50,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
  },
  ctaTxt: {
    color: colors.bg,
    fontFamily: fonts.titleXL,
    fontSize: 15,
  },
  ctaSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    height: 46,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.accent,
    marginTop: 8,
  },
  ctaSecondaryTxt: {
    color: colors.accent,
    fontFamily: fonts.titleXL,
    fontSize: 14,
  },
  later: {
    marginTop: 12,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  laterTxt: {
    color: colors.muted,
    fontFamily: fonts.ui,
    fontSize: 12,
    textDecorationLine: 'underline',
  },
});
