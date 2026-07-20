import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts, radius } from '../../theme';
import Avatar from '../Avatar';

const IcoStarFilled = () => (
  <Svg width={11} height={11} viewBox="0 0 24 24">
    <Path
      d="M12 17.8 5.8 21 7 14.1 2 9.3l7-1L12 2l3 6.3 7 1-5 4.8 1.2 6.9z"
      fill={colors.accent}
    />
  </Svg>
);

const IcoEdit = () => (
  <Svg
    width={16}
    height={16}
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke={colors.muted} />
    <Path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z" stroke={colors.muted} />
  </Svg>
);

export interface ProfileIdCardProps {
  name: string;
  phone: string;
  avatarUrl?: string | null;
  avatarVariant: 'user' | 'shop';
  showBorder?: boolean;
  uploading: boolean;
  onEditAvatar: () => void;
  chipLabel: string;
  bottomSpacing?: number;
  starRating?: number | null;
  starCount?: number;
}

export function ProfileIdCard({
  name,
  phone,
  avatarUrl,
  avatarVariant,
  showBorder,
  uploading,
  onEditAvatar,
  chipLabel,
  bottomSpacing = 24,
  starRating,
  starCount,
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
        <View style={styles.chipRow}>
          <View style={styles.chip}>
            <Text style={styles.chipTxt}>{chipLabel}</Text>
          </View>
          {starRating != null && (
            <View style={styles.ratingBadge}>
              <IcoStarFilled />
              <Text style={styles.ratingTxt}>
                {starCount && starCount > 0
                  ? `${starRating.toFixed(1)} (${starCount} avis)`
                  : '0'}
              </Text>
            </View>
          )}
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
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  chip: {
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
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(253,207,52,.08)',
    borderWidth: 1,
    borderColor: 'rgba(253,207,52,.2)',
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  ratingTxt: {
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
