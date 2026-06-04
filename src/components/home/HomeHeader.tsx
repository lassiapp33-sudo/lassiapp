import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { colors, fonts } from '../../theme';
import { IcoChevron } from '../icons';

// ─── Icônes ──────────────────────────────────────────────────────────────────

const IconPin = () => (
  <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" strokeWidth={2}>
    <Path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" stroke={colors.accent} />
    <Circle cx={12} cy={10} r={3} stroke={colors.accent} />
  </Svg>
);

const IconBell = () => (
  <Svg
    width={22}
    height={22}
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth={1.9}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke={colors.white} />
    <Path d="M13.73 21a2 2 0 0 1-3.46 0" stroke={colors.white} />
  </Svg>
);

// ─── Props ───────────────────────────────────────────────────────────────────

interface Props {
  quartier?: string;
  unreadCount?: number;
  onLocation?: () => void;
  onAvatar?: () => void; // ouvre les notifications
  // Props conservées pour compatibilité (inutilisées visuellement)
  initial?: string;
  name?: string;
  avatarUrl?: string | null;
}

// ─── Composant ───────────────────────────────────────────────────────────────

export default function HomeHeader({
  quartier = 'Grand Dakar',
  unreadCount = 0,
  onLocation,
  onAvatar,
}: Props) {
  // Affiche "99+" si le nombre dépasse 99
  const badgeLabel = unreadCount > 99 ? '99+' : String(unreadCount);

  return (
    <View style={styles.row}>
      {/* ── Position ─────────────────────────────────────────────── */}
      <TouchableOpacity onPress={onLocation} activeOpacity={0.7}>
        <View style={styles.locLabel}>
          <IconPin />
          <Text style={styles.locLabelTxt}>Ta position</Text>
        </View>
        <View style={styles.locValue}>
          <Text style={styles.locValueTxt}>{quartier}</Text>
          <IcoChevron />
        </View>
      </TouchableOpacity>

      {/* ── Cloche de notification ────────────────────────────────── */}
      <TouchableOpacity style={styles.bellWrap} onPress={onAvatar} activeOpacity={0.8}>
        <IconBell />

        {/* Badge numérique — visible seulement si unreadCount > 0 */}
        {unreadCount > 0 && (
          <View style={[styles.badge, unreadCount > 9 && styles.badgeWide]}>
            <Text style={styles.badgeTxt}>{badgeLabel}</Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },

  locLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locLabelTxt: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11,
  },
  locValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  locValueTxt: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 15,
  },

  // Bouton cloche
  bellWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#1e2044',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Badge rouge avec le nombre
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#ff4d4f',
    borderWidth: 2,
    borderColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeWide: {
    borderRadius: 9,
    paddingHorizontal: 5,
  },
  badgeTxt: {
    color: '#fff',
    fontFamily: fonts.title,
    fontSize: 10,
    lineHeight: 14,
  },
});
