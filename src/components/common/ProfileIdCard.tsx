import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts, radius } from '../../theme';
import Avatar from '../Avatar';

const IcoEdit = () => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" strokeWidth={2}
    strokeLinecap="round" strokeLinejoin="round">
    <Path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke={colors.muted} />
    <Path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z" stroke={colors.muted} />
  </Svg>
);

export interface ProfileIdCardProps {
  name:           string;
  phone:          string;
  avatarUrl?:     string | null;
  avatarVariant:  'user' | 'shop';
  showBorder?:    boolean;
  uploading:      boolean;
  onEditAvatar:   () => void;
  chipLabel:      string;
  bottomSpacing?: number;
}

export function ProfileIdCard({
  name, phone, avatarUrl, avatarVariant, showBorder, uploading,
  onEditAvatar, chipLabel, bottomSpacing = 24,
}: ProfileIdCardProps) {
  return (
    <View style={[styles.card, { marginBottom: bottomSpacing }]}>
      <Avatar
        imageUrl={avatarUrl}
        name={name}
        size={66}
        variant={avatarVariant}
        showBorder={showBorder}
        uploading={uploading}
        onPress={onEditAvatar}
      />
      <View style={styles.info}>
        <Text style={styles.name}>{name}</Text>
        {phone ? <Text style={styles.phone}>🇸🇳 +221 {phone}</Text> : null}
        <View style={styles.chip}>
          <Text style={styles.chipTxt}>{chipLabel}</Text>
        </View>
      </View>
      <TouchableOpacity style={styles.editBtn} onPress={onEditAvatar} activeOpacity={0.7}>
        <IcoEdit />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  info: { flex: 1, minWidth: 0 },
  name: {
    color: colors.white,
    fontFamily: fonts.titleXL,
    fontSize: 17,
  },
  phone: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
    marginTop: 3,
  },
  chip: {
    alignSelf: 'flex-start',
    marginTop: 8,
    backgroundColor: 'rgba(253,207,52,.12)',
    borderWidth: 1,
    borderColor: 'rgba(253,207,52,.3)',
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  chipTxt: {
    color: colors.accent,
    fontFamily: fonts.ui,
    fontSize: 10,
  },
  editBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,.05)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
