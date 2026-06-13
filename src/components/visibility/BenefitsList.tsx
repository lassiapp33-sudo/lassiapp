import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts } from '../../theme';
import { IcoSearch } from '../icons';

// ─── Icônes bénéfices ─────────────────────────────────────────────────────────

const IcoStore = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" strokeWidth={1.8}>
    <Path
      d="M3 9l1-5h16l1 5M4 9v11a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9M3 9h18"
      stroke={colors.accent}
    />
  </Svg>
);

const IcoPulse = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" strokeWidth={1.8}>
    <Path d="M22 12h-4l-3 9L9 3l-3 9H2" stroke={colors.accent} />
  </Svg>
);

const IcoPin = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" strokeWidth={1.8}>
    <Path
      d="M12 21s-7-5.5-7-11a7 7 0 1 1 14 0c0 5.5-7 11-7 11z"
      stroke={colors.accent}
    />
    <Path d="M12 13a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" stroke={colors.accent} />
  </Svg>
);

// ─── Config bénéfices ─────────────────────────────────────────────────────────

export type BenefitsVariant = 'quartier' | 'recherche' | 'carte';

interface Benefit {
  Icon: React.ComponentType;
  title: string;
  desc: string;
}

const BENEFITS_BY_VARIANT: Record<BenefitsVariant, Benefit[]> = {
  quartier: [
    {
      Icon: IcoStore,
      title: "Placement premium sur l'accueil",
      desc: "Ta carte apparaît dès l'ouverture de l'app",
    },
    {
      Icon: () => <IcoSearch color={colors.accent} />,
      title: 'Visible dans toutes les catégories',
      desc: 'Même quand le client cherche autre chose',
    },
    {
      Icon: IcoPulse,
      title: 'Tunnel direct vers ta boutique',
      desc: '1 clic = le client entre chez toi',
    },
  ],
  recherche: [
    {
      Icon: () => <IcoSearch color={colors.accent} />,
      title: 'Premier dans les résultats',
      desc: 'Ta boutique apparaît avant les autres',
    },
    {
      Icon: IcoStore,
      title: 'Visible dans ta catégorie',
      desc: "Dès qu'un client cherche ce que tu proposes",
    },
    {
      Icon: IcoPulse,
      title: 'Plus de clics, plus de visites',
      desc: 'Une meilleure position = plus de clients',
    },
  ],
  carte: [
    {
      Icon: IcoPin,
      title: 'Épingle dorée prioritaire',
      desc: 'Ta boutique se démarque sur la carte',
    },
    {
      Icon: () => <IcoSearch color={colors.accent} />,
      title: "Visible d'un coup d'œil",
      desc: 'Les clients proches te repèrent vite',
    },
    {
      Icon: IcoPulse,
      title: 'Plus de visites en boutique',
      desc: 'Une carte qui attire l’œil attire les clients',
    },
  ],
};

// ─── Composant ────────────────────────────────────────────────────────────────

interface Props {
  variant?: BenefitsVariant;
}

export default function BenefitsList({ variant = 'quartier' }: Props) {
  return (
    <View style={styles.wrap}>
      {BENEFITS_BY_VARIANT[variant].map((b, i) => (
        <View key={i} style={styles.row}>
          <View style={styles.iconBox}>
            <b.Icon />
          </View>
          <View style={styles.text}>
            <Text style={styles.title}>{b.title}</Text>
            <Text style={styles.desc}>{b.desc}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 18,
    marginBottom: 22,
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: 'rgba(253,207,52,.12)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  text: { flex: 1 },
  title: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 13.5,
  },
  desc: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11,
    marginTop: 1,
    lineHeight: 16,
  },
});
