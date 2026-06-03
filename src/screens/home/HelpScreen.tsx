import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { colors, fonts, radius, TOP_INSET } from '../../theme';
import { contacterServiceClient } from '../../config/contact';
import { useT } from '../../i18n';
import { FaqItem, FaqSection, StepItem } from '../../i18n/types';
import { IcoBack } from '../../components/icons';

// ─── Icônes ───────────────────────────────────────────────────────────────────

const IcoChevron = ({ open }: { open: boolean }) => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" strokeWidth={2.5}
    style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}>
    <Path d="m6 9 6 6 6-6" stroke={colors.muted} />
  </Svg>
);

const IcoWhatsApp = () => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
    <Path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.5 3.58 1.37 5.07L2 22l5.07-1.35A9.96 9.96 0 0 0 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2z" fill={colors.accent} />
    <Path d="M16.5 14.5c-.28-.14-1.63-.8-1.88-.9-.25-.09-.43-.14-.61.14-.18.28-.7.9-.86 1.08-.16.18-.32.2-.6.07-.28-.14-1.17-.43-2.23-1.37-.82-.73-1.38-1.64-1.54-1.92-.16-.28-.02-.43.12-.57.13-.12.28-.32.42-.48.14-.16.18-.28.28-.46.09-.18.05-.34-.02-.48-.07-.14-.61-1.47-.84-2.01-.22-.53-.45-.46-.61-.47l-.52-.01c-.18 0-.46.07-.7.34-.25.27-.95.93-.95 2.26s.97 2.62 1.11 2.8c.13.18 1.91 2.92 4.64 4.1.65.28 1.16.45 1.55.57.65.21 1.24.18 1.71.11.52-.08 1.6-.66 1.83-1.29.22-.63.22-1.17.15-1.29-.06-.11-.24-.18-.52-.32z" fill={colors.bg} />
  </Svg>
);

// ─── Icônes étapes CLIENT ─────────────────────────────────────────────────────

const IcoShop = () => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" strokeWidth={1.8}>
    <Path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" stroke={colors.accent} />
    <Path d="M9 22V12h6v10" stroke={colors.accent} />
  </Svg>
);

const IcoCart = () => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" strokeWidth={1.8}>
    <Path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" stroke={colors.accent} />
    <Path d="M3 6h18M16 10a4 4 0 0 1-8 0" stroke={colors.accent} />
  </Svg>
);

const IcoPay = () => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" strokeWidth={1.8}>
    <Path d="M20 6 9 17l-5-5" stroke={colors.accent} />
  </Svg>
);

// ─── Icônes étapes PRESTATAIRE ────────────────────────────────────────────────

const IcoStore = () => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" strokeWidth={1.8}>
    <Path d="M4 3h16l-2 9H6L4 3z" stroke={colors.accent} />
    <Path d="M4 3L2 1M20 3l2-2" stroke={colors.accent} strokeLinecap="round" />
    <Circle cx={9} cy={19} r={2} stroke={colors.accent} />
    <Circle cx={17} cy={19} r={2} stroke={colors.accent} />
    <Path d="M6 12v7h12v-7" stroke={colors.accent} />
  </Svg>
);

const IcoOrder = () => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" strokeWidth={1.8}>
    <Path d="M9 11l3 3L22 4" stroke={colors.accent} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" stroke={colors.accent} strokeLinecap="round" />
  </Svg>
);

const IcoCash = () => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" strokeWidth={1.8}>
    <Path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" stroke={colors.accent} strokeLinecap="round" />
  </Svg>
);

// Icon arrays matched to step order in translations
const CLIENT_ICONS   = [IcoShop, IcoCart, IcoPay];
const MERCHANT_ICONS = [IcoStore, IcoOrder, IcoCash];

// ─── Composant accordéon ──────────────────────────────────────────────────────

function FaqRow({ item, last }: { item: FaqItem; last?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={[styles.faqRow, last && styles.faqRowLast]}>
      <TouchableOpacity style={styles.faqQ} onPress={() => setOpen(v => !v)} activeOpacity={0.75}>
        <Text style={styles.faqQTxt}>{item.q}</Text>
        <IcoChevron open={open} />
      </TouchableOpacity>
      {open && <Text style={styles.faqA}>{item.a}</Text>}
    </View>
  );
}

// ─── Étape ───────────────────────────────────────────────────────────────────

function Step({ Icon, step, num, last }: {
  Icon: () => React.JSX.Element;
  step: StepItem;
  num:  number;
  last: boolean;
}) {
  return (
    <View style={[styles.step, !last && styles.stepBorder]}>
      <View style={styles.stepLeft}>
        <View style={styles.stepNum}>
          <Text style={styles.stepNumTxt}>{num}</Text>
        </View>
        {!last && <View style={styles.stepLine} />}
      </View>
      <View style={styles.stepBody}>
        <View style={styles.stepIconWrap}><Icon /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.stepTitle}>{step.title}</Text>
          <Text style={styles.stepDesc}>{step.desc}</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Écran ────────────────────────────────────────────────────────────────────

interface Props {
  onBack: () => void;
  role?:  'client' | 'merchant';
}

export default function HelpScreen({ onBack, role = 'client' }: Props) {
  const t          = useT();
  const isMerchant = role === 'merchant';
  const steps      = isMerchant ? t.help.merchantSteps : t.help.clientSteps;
  const icons      = isMerchant ? MERCHANT_ICONS : CLIENT_ICONS;
  const faq        = isMerchant ? t.help.merchantFaq  : t.help.clientFaq;
  const waMsg = isMerchant
    ? 'Bonjour Lassi, je suis un prestataire et j\'ai besoin d\'aide avec mon compte.'
    : 'Bonjour Lassi, je suis un client et j\'ai besoin d\'aide avec mon compte.';

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: TOP_INSET + 4 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.75}>
          <IcoBack />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t.help.title}</Text>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}>

        <Text style={styles.secLabel}>{t.help.howItWorks}</Text>
        <View style={styles.stepsCard}>
          {steps.map((s, i) => {
            const Icon = icons[i];
            return (
              <Step key={i} Icon={Icon} step={s} num={i + 1} last={i === steps.length - 1} />
            );
          })}
        </View>

        <Text style={[styles.secLabel, { marginTop: 8 }]}>{t.help.faq}</Text>
        {(faq as FaqSection[]).map((section, si) => (
          <View key={si} style={styles.faqSection}>
            <Text style={styles.faqCat}>{section.category}</Text>
            <View style={styles.faqCard}>
              {section.items.map((item, ii) => (
                <FaqRow key={ii} item={item} last={ii === section.items.length - 1} />
              ))}
            </View>
          </View>
        ))}

        <TouchableOpacity style={styles.waBtn} onPress={() => contacterServiceClient(waMsg)} activeOpacity={0.85}>
          <IcoWhatsApp />
          <View>
            <Text style={styles.waBtnTitle}>{t.help.needHelp}</Text>
            <Text style={styles.waBtnSub}>{t.help.contactWa}</Text>
          </View>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 18, paddingBottom: 14,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: radius.sm,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { color: colors.white, fontFamily: fonts.titleXL, fontSize: 20 },

  secLabel: {
    color: colors.muted, fontFamily: fonts.ui, fontSize: 11,
    letterSpacing: 0.5, textTransform: 'uppercase',
    paddingHorizontal: 18, paddingBottom: 10, paddingTop: 4,
  },

  stepsCard: {
    marginHorizontal: 18, marginBottom: 20,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, paddingHorizontal: 14, paddingVertical: 6,
  },
  step: {
    flexDirection: 'row', paddingVertical: 14, gap: 12,
  },
  stepBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  stepLeft:   { alignItems: 'center', width: 26 },
  stepNum: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: 'rgba(253,207,52,.15)',
    borderWidth: 1, borderColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  stepNumTxt: { color: colors.accent, fontFamily: fonts.ui, fontSize: 12 },
  stepLine:   { flex: 1, width: 1, backgroundColor: colors.border, marginTop: 4 },
  stepBody:   { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  stepIconWrap: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(253,207,52,.08)',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  stepTitle: { color: colors.white, fontFamily: fonts.ui, fontSize: 13.5, marginBottom: 3 },
  stepDesc:  { color: colors.muted, fontFamily: fonts.body, fontSize: 11.5, lineHeight: 17 },

  faqSection: { marginBottom: 16 },
  faqCat: {
    color: colors.accent, fontFamily: fonts.ui, fontSize: 11,
    letterSpacing: 0.4, textTransform: 'uppercase',
    paddingHorizontal: 18, paddingBottom: 8,
  },
  faqCard: {
    marginHorizontal: 18, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, overflow: 'hidden',
  },
  faqRow:     { borderBottomWidth: 1, borderBottomColor: colors.border },
  faqRowLast: { borderBottomWidth: 0 },
  faqQ: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', padding: 14, gap: 10,
  },
  faqQTxt: { flex: 1, color: colors.white, fontFamily: fonts.ui, fontSize: 13 },
  faqA:    { color: colors.muted, fontFamily: fonts.body, fontSize: 12, lineHeight: 18, paddingHorizontal: 14, paddingBottom: 14 },

  waBtn: {
    marginHorizontal: 18, marginTop: 8,
    backgroundColor: 'rgba(253,207,52,.08)',
    borderWidth: 1, borderColor: 'rgba(253,207,52,.25)',
    borderRadius: radius.lg, padding: 16,
    flexDirection: 'row', alignItems: 'center', gap: 14,
  },
  waBtnTitle: { color: colors.white, fontFamily: fonts.ui, fontSize: 14 },
  waBtnSub:   { color: colors.muted, fontFamily: fonts.body, fontSize: 11.5, marginTop: 2 },
});
