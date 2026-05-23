import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts } from '../../theme';
import { StoreProfile } from '../../types/store';

// ─── Icône crayon ────────────────────────────────────────────────────────────

const IcoPencil = ({ size = 11, color = colors.accent }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" strokeWidth={2}>
    <Path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke={color} />
    <Path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z" stroke={color} />
  </Svg>
);

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
  profile:    StoreProfile;
  onToggle:   () => void;
  onEditLogo: () => void;
}

export default function ShopProfileCard({ profile, onToggle, onEditLogo }: Props) {
  return (
    <View style={styles.card}>
      {/* Logo + infos */}
      <View style={styles.row}>
        {/* Logo avec badge édition */}
        <TouchableOpacity style={styles.logoWrap} onPress={onEditLogo} activeOpacity={0.85}>
          <View style={styles.logo}>
            <Text style={styles.logoTxt}>{profile.initial}</Text>
          </View>
          <View style={styles.editBadge}>
            <IcoPencil size={11} color={colors.accent} />
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
          <Text style={[styles.toggleStatus, { color: profile.isOpen ? colors.success : colors.muted }]}>
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

  logoWrap: { position: 'relative', flexShrink: 0 },
  logo: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoTxt: {
    color: colors.bg,
    fontFamily: fonts.titleXL,
    fontSize: 24,
  },
  editBadge: {
    position: 'absolute',
    bottom: -3,
    right: -3,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
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
