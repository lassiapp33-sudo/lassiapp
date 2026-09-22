import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, fonts, radius, TOP_INSET } from '../../theme';
import { IcoStore } from '../common/LassiIcons';

interface Props {
  carrouselProduits: number;
  onDiscover: () => void;
  onDismiss: () => void;
}

// Banner de bienvenue (pas modal) — annonce le cadeau "Offre du Quartier"
// (recompense type_classement='bienvenue') à la création du compte prestataire.
export default function WelcomeRewardBanner({ carrouselProduits, onDiscover, onDismiss }: Props) {
  const slideY = useRef(new Animated.Value(-220)).current;

  useEffect(() => {
    Animated.timing(slideY, {
      toValue: 0,
      duration: 340,
      useNativeDriver: true,
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const slideOut = (done?: () => void) => {
    Animated.timing(slideY, {
      toValue: -220,
      duration: 260,
      useNativeDriver: true,
    }).start(() => done?.());
  };

  const s2 = carrouselProduits > 1 ? 's' : '';

  return (
    <Animated.View style={[s.wrap, { transform: [{ translateY: slideY }] }]}>
      <View style={s.row}>
        <View style={s.iconBox}>
          <IcoStore size={28} />
        </View>

        <View style={s.txt}>
          <Text style={s.title}>Cadeau de bienvenue 🎁</Text>
          <Text style={s.body}>
            Tu reçois {carrouselProduits} emplacement{s2} offert{s2} dans le carrousel "Offre du
            Quartier" — mets en avant tes meilleurs produits auprès de tous les clients dès
            aujourd'hui.
          </Text>
        </View>

        <TouchableOpacity
          style={s.closeBtn}
          onPress={() => slideOut(onDismiss)}
          hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
          activeOpacity={0.7}
        >
          <Text style={s.closeTxt}>✕</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={s.cta} onPress={() => slideOut(onDiscover)} activeOpacity={0.85}>
        <Text style={s.ctaTxt}>Choisir mes produits</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: TOP_INSET + 4,
    left: 12,
    right: 12,
    zIndex: 9999,
    elevation: 20,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', padding: 12, gap: 10 },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(253,207,52,.13)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  txt: { flex: 1 },
  title: { color: colors.white, fontFamily: fonts.title, fontSize: 14 },
  body: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
    marginTop: 3,
    lineHeight: 17,
  },
  closeBtn: {
    paddingRight: 4,
    paddingLeft: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeTxt: { color: colors.muted, fontSize: 15, fontFamily: fonts.ui },
  cta: {
    marginHorizontal: 12,
    marginBottom: 10,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaTxt: { color: colors.bg, fontFamily: fonts.titleXL, fontSize: 14 },
});
