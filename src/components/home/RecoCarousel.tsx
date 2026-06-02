import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts, radius } from '../../theme';
import Avatar from '../Avatar';

export interface RecoItem {
  id:       string;
  initial:  string;
  name:     string;
  desc:     string;
  logoUrl?: string | null;
}

interface Props {
  items:     RecoItem[];
  onPress?:  (id: string) => void;
}

const IconStar = () => (
  <Svg width={11} height={11} viewBox="0 0 24 24" fill="none" strokeWidth={2.5}>
    <Path d="M12 2 15 9 22 9 16 14 18 21 12 17 6 21 8 14 2 9 9 9z" stroke={colors.bg} fill={colors.bg} />
  </Svg>
);

export default function RecoCarousel({ items, onPress }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.list}
    >
      {items.map(item => (
        <TouchableOpacity
          key={item.id}
          style={styles.card}
          onPress={() => onPress?.(item.id)}
          activeOpacity={0.85}
        >
          {/* Badge RECOMMANDÉ */}
          <View style={styles.badge}>
            <IconStar />
            <Text style={styles.badgeTxt}>RECOMMANDÉ</Text>
          </View>

          {/* Contenu bas de carte */}
          <View style={styles.content}>
            {/* Logo boutique recommandée — Avatar unique */}
            <Avatar
              imageUrl={item.logoUrl}
              name={item.name}
              size={38}
              variant="shop"
              style={{ marginBottom: 8 }}
            />
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.desc}>{item.desc}</Text>
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  list: { gap: 14, paddingBottom: 6 },
  card: {
    width: 240,
    height: 130,
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderColor: colors.accent,
    backgroundColor: '#1A1B38',
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  badge: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.accent,
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: 8,
    zIndex: 2,
  },
  badgeTxt: {
    color: colors.bg,
    fontFamily: fonts.title,
    fontSize: 9.5,
    letterSpacing: 0.3,
  },
  content: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 14,
  },
  name: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 15,
  },
  desc: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11,
    marginTop: 2,
  },
});
