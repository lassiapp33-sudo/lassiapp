import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { colors, fonts, radius } from '../../theme';

// ─── Icônes ──────────────────────────────────────────────────────────────────

const IcoBook = ({ stroke }: { stroke: string }) => (
  <Svg
    width={21}
    height={21}
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" stroke={stroke} />
    <Path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" stroke={stroke} />
  </Svg>
);

const IcoMsg = ({ stroke }: { stroke: string }) => (
  <Svg
    width={21}
    height={21}
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke={stroke} />
  </Svg>
);

const IcoMapPin = ({ stroke }: { stroke: string }) => (
  <Svg
    width={21}
    height={21}
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z" stroke={stroke} />
    <Path d="M12 10m-2 0a2 2 0 1 0 4 0 2 2 0 1 0-4 0" stroke={stroke} />
  </Svg>
);

const IcoGrid = ({ stroke }: { stroke: string }) => (
  <Svg
    width={21}
    height={21}
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Rect x={3} y={3} width={7} height={7} rx={1} stroke={stroke} />
    <Rect x={14} y={3} width={7} height={7} rx={1} stroke={stroke} />
    <Rect x={3} y={14} width={7} height={7} rx={1} stroke={stroke} />
    <Rect x={14} y={14} width={7} height={7} rx={1} stroke={stroke} />
  </Svg>
);

const IcoStar = ({ stroke }: { stroke: string }) => (
  <Svg
    width={21}
    height={21}
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Path
      d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
      stroke={stroke}
    />
  </Svg>
);

// ─── Carte d'action individuelle ──────────────────────────────────────────────

interface ActionCardProps {
  Icon: React.FC<{ stroke: string }>;
  iconBg: string;
  iconStroke: string;
  title: string;
  desc: string;
  badge?: number;
  onPress?: () => void;
}

function ActionCard({ Icon, iconBg, iconStroke, title, desc, badge, onPress }: ActionCardProps) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.iconBox, { backgroundColor: iconBg }]}>
        <Icon stroke={iconStroke} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.desc}>{desc}</Text>
      {badge !== undefined && badge > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeTxt}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Grille 2×2 ──────────────────────────────────────────────────────────────

interface Props {
  onPress?: (key: string) => void;
  debtCount?: number;
  msgCount?: number;
  avisCount?: number;
  showTerrains?: boolean;
}

export default function QuickActions({
  onPress,
  debtCount = 0,
  msgCount = 0,
  avisCount = 0,
  showTerrains = false,
}: Props) {
  return (
    <View style={styles.grid}>
      <View style={styles.row}>
        <ActionCard
          Icon={IcoBook}
          iconBg="rgba(253,207,52,.13)"
          iconStroke={colors.accent}
          title="Cahier de dettes"
          desc={
            debtCount > 0
              ? `${debtCount} client${debtCount > 1 ? 's' : ''} en dette`
              : 'Aucune dette'
          }
          badge={debtCount}
          onPress={() => onPress?.('debts')}
        />
        <ActionCard
          Icon={IcoMsg}
          iconBg="rgba(29,200,242,.13)"
          iconStroke="#1DC8F2"
          title="Messages clients"
          desc={
            msgCount > 0 ? `${msgCount} non lu${msgCount > 1 ? 's' : ''}` : 'Réponds à tes clients'
          }
          badge={msgCount}
          onPress={() => onPress?.('messages')}
        />
      </View>
      <View style={styles.row}>
        <ActionCard
          Icon={IcoMapPin}
          iconBg="rgba(253,207,52,.13)"
          iconStroke={colors.accent}
          title="Autour de moi"
          desc="Découvre et commande chez d'autres"
          onPress={() => onPress?.('aroundme')}
        />
        <ActionCard
          Icon={IcoGrid}
          iconBg="rgba(240,168,71,.13)"
          iconStroke={colors.orange}
          title="Ma vitrine"
          desc="Gérer mes produits"
          onPress={() => onPress?.('store')}
        />
      </View>
      <View style={styles.row}>
        <ActionCard
          Icon={IcoStar}
          iconBg="rgba(95,211,138,.13)"
          iconStroke={colors.success}
          title="Mes avis"
          desc={
            avisCount > 0
              ? `${avisCount} avis client${avisCount > 1 ? 's' : ''}`
              : 'Voir et répondre aux avis'
          }
          badge={undefined}
          onPress={() => onPress?.('avis')}
        />
        {showTerrains && (
          <ActionCard
            Icon={IcoGrid}
            iconBg="rgba(95,211,138,.13)"
            iconStroke={colors.success}
            title="Mes terrains"
            desc="Gérer, réservations, scanner QR"
            onPress={() => onPress?.('terrains')}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { gap: 11, marginBottom: 24 },
  row: { flexDirection: 'row', gap: 11 },

  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 15,
    position: 'relative',
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 11,
  },
  title: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 13.5,
  },
  desc: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 10.5,
    marginTop: 2,
  },
  badge: {
    position: 'absolute',
    top: 13,
    right: 13,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  badgeTxt: {
    color: colors.white,
    fontFamily: fonts.titleXL,
    fontSize: 9,
  },
});
