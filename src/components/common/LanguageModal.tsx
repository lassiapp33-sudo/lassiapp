import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import { colors, fonts, radius } from '../../theme';
import useLanguageStore, { Lang } from '../../store/languageStore';

const IcoCheck = () => (
  <Svg
    width={16}
    height={16}
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth={2.5}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Polyline points="20 6 9 17 4 12" stroke={colors.accent} />
  </Svg>
);

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function LanguageModal({ visible, onClose }: Props) {
  const lang = useLanguageStore(s => s.lang);
  const setLang = useLanguageStore(s => s.setLang);

  const select = (l: Lang) => {
    setLang(l);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.card} onStartShouldSetResponder={() => true}>
          <Text style={styles.title}>Langue / Language</Text>

          <TouchableOpacity
            style={[styles.row, lang === 'fr' && styles.rowActive]}
            onPress={() => select('fr')}
            activeOpacity={0.7}
          >
            <Text style={styles.flag}>🇫🇷</Text>
            <Text style={[styles.lbl, lang === 'fr' && styles.lblActive]}>Français</Text>
            {lang === 'fr' ? <IcoCheck /> : <View style={styles.checkPlaceholder} />}
          </TouchableOpacity>

          <View style={styles.separator} />

          <TouchableOpacity
            style={[styles.row, lang === 'en' && styles.rowActive]}
            onPress={() => select('en')}
            activeOpacity={0.7}
          >
            <Text style={styles.flag}>🇬🇧</Text>
            <Text style={[styles.lbl, lang === 'en' && styles.lblActive]}>English</Text>
            {lang === 'en' ? <IcoCheck /> : <View style={styles.checkPlaceholder} />}
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  card: {
    width: '100%',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    paddingVertical: 8,
    overflow: 'hidden',
  },
  title: {
    color: colors.muted,
    fontFamily: fonts.ui,
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 12,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  rowActive: {
    backgroundColor: 'rgba(253,207,52,0.06)',
  },
  flag: {
    fontSize: 22,
  },
  lbl: {
    flex: 1,
    color: colors.white,
    fontFamily: fonts.ui,
    fontSize: 15,
  },
  lblActive: {
    color: colors.accent,
  },
  checkPlaceholder: {
    width: 16,
    height: 16,
  },
});
