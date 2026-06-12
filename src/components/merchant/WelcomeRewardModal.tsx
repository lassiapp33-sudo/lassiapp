import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { colors, fonts, radius } from '../../theme';

interface Props {
  visible: boolean;
  carrouselProduits: number;
  onClose: () => void;
  onDiscover: () => void;
}

// Modal de bienvenue affiché une seule fois, à la création du compte
// prestataire — annonce le cadeau "Offre di Quartier" (recompense
// type_classement='bienvenue', voir 20260612160000_recompense_bienvenue.sql).
export default function WelcomeRewardModal({
  visible,
  carrouselProduits,
  onClose,
  onDiscover,
}: Props) {
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.card}>
          <Text style={s.emoji}>🎁</Text>
          <Text style={s.title}>Bienvenue sur LASSI !</Text>
          <Text style={s.txt}>
            Pour démarrer, tu reçois {carrouselProduits} emplacement
            {carrouselProduits > 1 ? 's' : ''} offert{carrouselProduits > 1 ? 's' : ''} dans le
            carrousel "Offre di Quartier" — mets en avant tes meilleurs produits auprès de tous
            les clients dès aujourd'hui.
          </Text>

          <TouchableOpacity style={s.cta} onPress={onDiscover} activeOpacity={0.85}>
            <Text style={s.ctaTxt}>Choisir mes produits</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={s.skipBtn}>
            <Text style={s.skip}>Plus tard</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.xl,
    padding: 22,
    alignItems: 'center',
    gap: 6,
  },
  emoji: { fontSize: 44, marginBottom: 4 },
  title: {
    color: colors.white,
    fontFamily: fonts.titleXL,
    fontSize: 19,
    textAlign: 'center',
  },
  txt: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    marginTop: 4,
    marginBottom: 12,
  },
  cta: {
    width: '100%',
    height: 50,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaTxt: {
    color: colors.bg,
    fontFamily: fonts.titleXL,
    fontSize: 15,
  },
  skipBtn: { marginTop: 12, padding: 4 },
  skip: {
    color: colors.muted,
    fontFamily: fonts.ui,
    fontSize: 13,
  },
});
