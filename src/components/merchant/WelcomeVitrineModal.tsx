import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { colors, fonts, radius } from '../../theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  onConfigure: () => void;
}

// Modal de bienvenue affichée une seule fois au prestataire — invite
// chaleureusement à configurer sa vitrine et amène directement dessus.
export default function WelcomeVitrineModal({ visible, onClose, onConfigure }: Props) {
  return (
    <Modal visible={visible} animationType="fade" transparent presentationStyle="overFullScreen" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.card}>
          <Text style={s.title}>Bienvenue sur LASSI</Text>
          <Text style={s.txt}>
            Ravis de t'accueillir ! Ta boutique n'attend plus que toi. Prends quelques minutes pour
            configurer ta vitrine : ajoute tes produits, tes photos et tes horaires pour séduire tes
            premiers clients.
          </Text>

          <TouchableOpacity style={s.cta} onPress={onConfigure} activeOpacity={0.85}>
            <Text style={s.ctaTxt}>Configurer ma vitrine</Text>
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
