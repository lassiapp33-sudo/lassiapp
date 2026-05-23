import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { colors, fonts, radius, TOP_INSET } from '../../theme';
import useAuthStore from '../../store/authStore';

// ─── Icônes ──────────────────────────────────────────────────────────────────

const IcoEdit = () => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke={colors.muted} />
    <Path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z" stroke={colors.muted} />
  </Svg>
);

const IcoOrder = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" stroke={colors.accent} />
    <Path d="M3 6h18M16 10a4 4 0 0 1-8 0" stroke={colors.accent} />
  </Svg>
);

const IcoStar = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M12 17.8 5.8 21 7 14.1 2 9.3l7-1L12 2l3 6.3 7 1-5 4.8 1.2 6.9z" stroke={colors.accent} />
  </Svg>
);

const IcoCard = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <Rect x={2} y={5} width={20} height={14} rx={2} stroke={colors.accent} />
    <Path d="M2 10h20" stroke={colors.accent} />
  </Svg>
);

const IcoBell = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" stroke={colors.accent} />
    <Path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" stroke={colors.accent} />
  </Svg>
);

const IcoGlobe = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <Circle cx={12} cy={12} r={10} stroke={colors.accent} />
    <Path d="M2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20Z" stroke={colors.accent} />
  </Svg>
);

const IcoPin = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" stroke={colors.accent} />
    <Circle cx={12} cy={10} r={3} stroke={colors.accent} />
  </Svg>
);

const IcoHelp = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <Circle cx={12} cy={12} r={10} stroke={colors.accent} />
    <Path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3" stroke={colors.accent} />
    <Path d="M12 17h.01" stroke={colors.accent} />
  </Svg>
);

const IcoLogout = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" stroke={colors.danger} />
  </Svg>
);

// ─── Toggle personnalisé ──────────────────────────────────────────────────────

function Toggle({ value, onToggle }: { value: boolean; onToggle: () => void }) {
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

// ─── Ligne d'option ───────────────────────────────────────────────────────────

interface RowProps {
  icon:        React.ReactNode;
  title:       string;
  subtitle?:   string;
  danger?:     boolean;
  end?:        'arrow' | 'toggle' | 'none';
  toggled?:    boolean;
  onToggle?:   () => void;
  onPress?:    () => void;
  last?:       boolean;
}

function OptionRow({ icon, title, subtitle, danger, end = 'arrow', toggled, onToggle, onPress, last }: RowProps) {
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
      {end === 'arrow'  && <Text style={styles.arrow}>›</Text>}
      {end === 'toggle' && <Toggle value={toggled ?? false} onToggle={onToggle ?? (() => {})} />}
    </TouchableOpacity>
  );
}

// ─── Écran ────────────────────────────────────────────────────────────────────

interface Props {
  onOrders?:    () => void;
  onFavorites?: () => void;
  onLogout?:    () => void;
}

export default function ClientProfileScreen({ onOrders, onFavorites, onLogout }: Props) {
  const [notifOn, setNotifOn] = useState(true);
  const user = useAuthStore(s => s.user);

  const displayName    = user?.name    ?? 'Client';
  const displayPhone   = user?.phone   ?? '';
  const displayInitial = user?.initial ?? '?';

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: TOP_INSET + 6, paddingBottom: 36, flexGrow: 1 }}
      >
        {/* Titre */}
        <Text style={styles.pageTitle}>Mon profil</Text>

        {/* Carte identité */}
        <View style={styles.idCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarTxt}>{displayInitial}</Text>
          </View>
          <View style={styles.idInfo}>
            <Text style={styles.idName}>{displayName}</Text>
            {displayPhone ? (
              <Text style={styles.idPhone}>🇸🇳 +221 {displayPhone}</Text>
            ) : null}
            <View style={styles.chip}>
              <Text style={styles.chipTxt}>👤 Client</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.editBtn} activeOpacity={0.7}>
            <IcoEdit />
          </TouchableOpacity>
        </View>

        {/* Mon activité */}
        <Text style={styles.secLbl}>Mon activité</Text>
        <View style={styles.grp}>
          <OptionRow icon={<IcoOrder />} title="Mes commandes"  subtitle="Historique & suivi" onPress={onOrders} />
          <OptionRow icon={<IcoStar />}  title="Mes favoris"    subtitle="12 commerces enregistrés" onPress={onFavorites} />
          <OptionRow icon={<IcoCard />}  title="Mes paiements"  subtitle="Reçus & historique Wave/OM" last />
        </View>

        {/* Préférences */}
        <Text style={styles.secLbl}>Préférences</Text>
        <View style={styles.grp}>
          <OptionRow
            icon={<IcoBell />} title="Notifications"
            end="toggle" toggled={notifOn} onToggle={() => setNotifOn(v => !v)}
          />
          <OptionRow icon={<IcoGlobe />} title="Langue"       subtitle="Français" />
          <OptionRow icon={<IcoPin />}   title="Mes adresses" last />
        </View>

        {/* Aide & compte */}
        <Text style={styles.secLbl}>Aide & compte</Text>
        <View style={styles.grp}>
          <OptionRow icon={<IcoHelp />}   title="Aide & support" />
          <OptionRow icon={<IcoLogout />} title="Se déconnecter" danger end="none" onPress={onLogout} last />
        </View>

        <Text style={styles.version}>LASSİ v1.0.0</Text>
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },

  pageTitle: {
    color: colors.white,
    fontFamily: fonts.titleXL,
    fontSize: 22,
    paddingHorizontal: 18,
    paddingBottom: 18,
  },

  // Carte identité
  idCard: {
    marginHorizontal: 18,
    marginBottom: 24,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatar: {
    width: 66,
    height: 66,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarTxt: {
    color: colors.accent,
    fontFamily: fonts.titleXL,
    fontSize: 26,
  },
  idInfo: { flex: 1, minWidth: 0 },
  idName: {
    color: colors.white,
    fontFamily: fonts.titleXL,
    fontSize: 17,
  },
  idPhone: {
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

  // Section label
  secLbl: {
    color: colors.muted,
    fontFamily: fonts.ui,
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    paddingHorizontal: 18,
    paddingBottom: 10,
  },

  // Groupe d'options
  grp: {
    marginHorizontal: 18,
    marginBottom: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },

  // Ligne d'option
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

  // Toggle
  sw: {
    width: 42,
    height: 24,
    borderRadius: 12,
    flexShrink: 0,
    justifyContent: 'center',
  },
  swOn:  { backgroundColor: colors.accent },
  swOff: { backgroundColor: colors.border },
  swKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  swKnobOn:  { backgroundColor: colors.bg,    alignSelf: 'flex-end',   marginRight: 2 },
  swKnobOff: { backgroundColor: colors.muted, alignSelf: 'flex-start', marginLeft: 2 },

  version: {
    color: '#3a3c5c',
    fontFamily: fonts.body,
    fontSize: 11,
    textAlign: 'center',
    paddingBottom: 10,
  },
});
