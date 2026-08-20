import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, fonts, radius } from '../../theme';
import type { ProduitExtrait } from '../../utils/parsingMenu';

interface Props {
  visible: boolean;
  onDone: (items: ProduitExtrait[]) => void;
  onClose: () => void;
}

export default function ScanMenuCamera({ visible, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.sheet}>
          <Text style={s.title}>Scanner un menu</Text>
          <Text style={s.body}>
            La reconnaissance de texte par photo n'est pas encore disponible sur iPhone.
            Ajoutez vos produits manuellement.
          </Text>
          <TouchableOpacity style={s.btn} onPress={onClose} activeOpacity={0.85}>
            <Text style={s.btnTxt}>Fermer</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 28,
    gap: 14,
    alignItems: 'center',
  },
  title: { color: colors.accent, fontFamily: fonts.title, fontSize: 18 },
  body: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  btn: {
    marginTop: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingVertical: 14,
    paddingHorizontal: 40,
  },
  btnTxt: { color: colors.white, fontFamily: fonts.ui, fontSize: 14 },
});
