import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, fonts } from '../../theme';
import Avatar from '../Avatar';

interface Props {
  initial: string;
  name: string;
  desc: string;
  logoUrl?: string | null;
  onPress?: () => void;
}

export default function SponsoredCard({ name, desc, logoUrl, onPress }: Props) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      {/* Tag sponsorisé */}
      <View style={styles.tag}>
        <Text style={styles.tagTxt}>SPONSORISÉ</Text>
      </View>

      {/* Logo boutique sponsorisée — Avatar unique */}
      <Avatar imageUrl={logoUrl} name={name} size={46} variant="shop" />

      {/* Infos */}
      <View style={styles.info}>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.desc} numberOfLines={2}>
          {desc}
        </Text>
      </View>

      {/* Flèche */}
      <Text style={styles.arrow}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1A1B38',
    borderWidth: 1.5,
    borderColor: colors.accent,
    borderRadius: 18,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    marginBottom: 11,
    position: 'relative',
  },
  tag: {
    position: 'absolute',
    top: -8,
    right: 14,
    backgroundColor: colors.accent,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  tagTxt: {
    color: colors.bg,
    fontFamily: fonts.title,
    fontSize: 8,
    letterSpacing: 0.3,
  },
  info: { flex: 1 },
  name: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 14.5,
    marginBottom: 3,
  },
  desc: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11,
    lineHeight: 16,
  },
  arrow: {
    color: colors.accent,
    fontSize: 22,
    lineHeight: 26,
  },
});
