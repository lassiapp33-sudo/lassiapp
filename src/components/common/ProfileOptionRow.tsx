import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, fonts } from '../../theme';

export interface ProfileRowProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  danger?: boolean;
  end?: 'arrow' | 'toggle' | 'none';
  toggled?: boolean;
  onToggle?: () => void;
  onPress?: () => void;
  last?: boolean;
}

function ProfileToggle({ value, onToggle }: { value: boolean; onToggle: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.sw, value ? styles.swOn : styles.swOff]}
      onPress={onToggle}
      activeOpacity={0.8}
    >
      <View style={[styles.swKnob, value ? styles.swKnobOn : styles.swKnobOff]} />
    </TouchableOpacity>
  );
}

export function ProfileOptionRow({
  icon,
  title,
  subtitle,
  danger,
  end = 'arrow',
  toggled,
  onToggle,
  onPress,
  last,
}: ProfileRowProps) {
  return (
    <TouchableOpacity
      style={[styles.opt, last && styles.optLast]}
      onPress={onPress}
      activeOpacity={end === 'toggle' ? 1 : 0.7}
    >
      <View style={[styles.optIc, danger && styles.optIcDanger]}>{icon}</View>
      <View style={styles.optTx}>
        <Text style={[styles.optTitle, danger && styles.optTitleDanger]}>{title}</Text>
        {subtitle ? <Text style={styles.optSub}>{subtitle}</Text> : null}
      </View>
      {end === 'arrow' && <Text style={styles.arrow}>›</Text>}
      {end === 'toggle' && (
        <ProfileToggle value={toggled ?? false} onToggle={onToggle ?? (() => {})} />
      )}
    </TouchableOpacity>
  );
}

export const profileRowStyles = StyleSheet.create({
  grp: {
    marginHorizontal: 18,
    marginBottom: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    overflow: 'hidden',
  },
  secLbl: {
    color: colors.muted,
    fontFamily: fonts.ui,
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    paddingHorizontal: 18,
    paddingBottom: 10,
  },
  version: {
    color: '#3a3c5c',
    fontFamily: fonts.body,
    fontSize: 11,
    textAlign: 'center',
    paddingBottom: 10,
  },
});

const styles = StyleSheet.create({
  opt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  optLast: { borderBottomWidth: 0 },

  optIc: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,.05)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  optIcDanger: { backgroundColor: 'rgba(224,122,122,.1)' },

  optTx: { flex: 1 },
  optTitle: {
    color: colors.white,
    fontFamily: fonts.ui,
    fontSize: 14,
  },
  optTitleDanger: { color: colors.danger },
  optSub: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 10.5,
    marginTop: 1,
  },

  arrow: {
    color: '#5a5c80',
    fontSize: 20,
    lineHeight: 22,
  },

  sw: {
    width: 42,
    height: 24,
    borderRadius: 12,
    flexShrink: 0,
    justifyContent: 'center',
  },
  swOn: { backgroundColor: colors.accent },
  swOff: { backgroundColor: colors.border },
  swKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  swKnobOn: { backgroundColor: colors.bg, alignSelf: 'flex-end', marginRight: 2 },
  swKnobOff: { backgroundColor: colors.muted, alignSelf: 'flex-start', marginLeft: 2 },
});
