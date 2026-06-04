import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, ActivityIndicator } from 'react-native';
import { colors, fonts } from '../../theme';

interface Props {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost';
  loading?: boolean; // affiche un spinner et désactive le bouton
  style?: ViewStyle;
}

export default function AuthButton({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  style,
}: Props) {
  const isPrimary = variant === 'primary';
  return (
    <TouchableOpacity
      style={[styles.btn, isPrimary ? styles.primary : styles.ghost, style]}
      onPress={onPress}
      activeOpacity={0.85}
      disabled={loading}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? colors.bg : colors.white} size="small" />
      ) : (
        <Text style={[styles.label, !isPrimary && styles.ghostLabel]}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    height: 55,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    backgroundColor: colors.accent,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 12,
  },
  label: {
    color: colors.bg,
    fontFamily: fonts.ui,
    fontSize: 16,
  },
  ghostLabel: {
    color: colors.white,
  },
});
