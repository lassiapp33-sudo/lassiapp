import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts, radius, TOP_INSET } from '../../theme';

// ─── Icônes ──────────────────────────────────────────────────────────────────

const IcoBack = () => (
  <Svg width={19} height={19} viewBox="0 0 24 24" fill="none"
    strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M19 12H5" stroke={colors.white} />
    <Path d="M12 19l-7-7 7-7" stroke={colors.white} />
  </Svg>
);

const IcoPhone = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"
    strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path
      d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z"
      stroke={colors.accent}
    />
  </Svg>
);

// ─── Composant ────────────────────────────────────────────────────────────────

interface Props {
  initial:  string;
  name:     string;
  isVip?:   boolean;
  isOnline: boolean;
  onBack:   () => void;
  onCall?:  () => void;
}

export default function ChatHeader({ initial, name, isVip, isOnline, onBack, onCall }: Props) {
  return (
    <View style={[styles.header, { paddingTop: TOP_INSET + 8 }]}>
      {/* Retour */}
      <TouchableOpacity style={styles.iconBtn} onPress={onBack} activeOpacity={0.8}>
        <IcoBack />
      </TouchableOpacity>

      {/* Logo commerçant */}
      <View style={styles.logo}>
        <Text style={styles.logoTxt}>{initial}</Text>
      </View>

      {/* Nom + statut */}
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {name}{isVip ? '  🏆' : ''}
        </Text>
        <View style={styles.statusRow}>
          <View style={[styles.dot, { backgroundColor: isOnline ? colors.success : colors.muted }]} />
          <Text style={[styles.status, { color: isOnline ? colors.success : colors.muted }]}>
            {isOnline ? 'En ligne' : 'Hors ligne'}
          </Text>
        </View>
      </View>

      {/* Appel */}
      <TouchableOpacity style={styles.iconBtn} onPress={onCall} activeOpacity={0.8}>
        <IcoPhone />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.bg,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  logo: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  logoTxt: {
    color: colors.bg,
    fontFamily: fonts.titleXL,
    fontSize: 17,
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 15,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 1,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  status: {
    fontFamily: fonts.body,
    fontSize: 11,
  },
});
