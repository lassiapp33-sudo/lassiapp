import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { colors, fonts } from '../../theme';
import { StoreProfile } from '../../types/store';
import Avatar from '../Avatar';

// ─── Interrupteur animé ───────────────────────────────────────────────────────

function ToggleSwitch({ isOn, onToggle }: { isOn: boolean; onToggle: () => void }) {
  // Anime uniquement le déplacement du thumb (useNativeDriver: true possible)
  const anim = useRef(new Animated.Value(isOn ? 1 : 0)).current;

  const handlePress = () => {
    Animated.timing(anim, {
      toValue: isOn ? 0 : 1,
      duration: 180,
      useNativeDriver: true,
    }).start();
    onToggle();
  };

  const translateX = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 18] });

  return (
    <TouchableOpacity
      style={[styles.track, { backgroundColor: isOn ? colors.success : colors.border }]}
      onPress={handlePress}
      activeOpacity={0.85}
    >
      <Animated.View style={[styles.thumb, { transform: [{ translateX }] }]} />
    </TouchableOpacity>
  );
}

// ─── Composant principal ─────────────────────────────────────────────────────

interface Props {
  profile: StoreProfile;
  onToggle: () => void;
  onEditLogo?: () => void;
}

export default function ShopProfileCard({ profile, onToggle, onEditLogo }: Props) {
  return (
    <View style={styles.card}>
      {/* Logo + infos */}
      <View style={styles.row}>
        {/* Logo boutique — cliquable pour modification */}
        <TouchableOpacity onPress={onEditLogo} activeOpacity={0.75} style={styles.logoWrap}>
          <Avatar imageUrl={profile.logoUrl} name={profile.name} size={60} variant="shop" />
          <View style={styles.logoBadge}>
            <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
              <Path
                d="M15.232 5.232l3.536 3.536M9 13l6.5-6.5a2 2 0 0 1 2.828 2.828L11.828 15.828 8 17l1.172-3.828Z"
                stroke="#14152A"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </View>
        </TouchableOpacity>

        {/* Nom et catégorie */}
        <View style={styles.info}>
          <Text style={styles.name}>{profile.name}</Text>
          <Text style={styles.subtitle}>{profile.subtitle}</Text>
        </View>
      </View>

      {/* Séparateur */}
      <View style={styles.sep} />

      {/* Toggle ouvert / fermé */}
      <View style={styles.toggleRow}>
        <ToggleSwitch isOn={profile.isOpen} onToggle={onToggle} />
        <View style={styles.toggleInfo}>
          <Text style={styles.toggleLabel}>
            {profile.isOpen ? 'Boutique ouverte' : 'Boutique fermée'}
          </Text>
          <Text
            style={[styles.toggleStatus, { color: profile.isOpen ? colors.success : colors.muted }]}
          >
            ● {profile.isOpen ? 'Visible par les clients' : 'Non visible par les clients'}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 18,
    marginBottom: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 15,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },

  logoWrap: {
    position: 'relative',
  },
  logoBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: colors.accent,
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
  info: { flex: 1 },
  name: {
    color: colors.white,
    fontFamily: fonts.titleXL,
    fontSize: 16,
  },
  subtitle: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11.5,
    marginTop: 2,
  },

  sep: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 13,
  },

  // Ligne toggle
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  track: {
    width: 42,
    height: 24,
    borderRadius: 12,
    padding: 2,
    justifyContent: 'center',
    flexShrink: 0,
  },
  thumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
  },
  toggleInfo: { flex: 1 },
  toggleLabel: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 13,
  },
  toggleStatus: {
    fontFamily: fonts.body,
    fontSize: 10.5,
    marginTop: 1,
  },
});
