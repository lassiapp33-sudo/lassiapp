import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import ViewShot, { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { colors, fonts, radius, TOP_INSET } from '../../theme';
import { IcoBack } from '../../components/icons';
import { IcoCrown } from '../../components/common/LassiIcons';
import LassiLogo from '../../components/LassiLogo';
import useAuthStore from '../../store/authStore';
import useShopStore from '../../store/shopStore';
import {
  getCertificatActif,
  formatPeriodeLabel,
  RecompenseAttribuee,
} from '../../services/classementService';
import { getErrorMessage, notifyError } from '../../utils/errorUtils';

interface Props {
  onBack: () => void;
}

export default function CertificatScreen({ onBack }: Props) {
  const userId = useAuthStore(s => s.user?.id);
  const shopName = useShopStore(s => s.profile.name);

  const [loading, setLoading] = useState(true);
  const [certificat, setCertificat] = useState<RecompenseAttribuee | null>(null);
  const [sharing, setSharing] = useState(false);
  const certRef = useRef<ViewShot>(null);

  const load = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setCertificat(await getCertificatActif(userId));
    } catch (e) {
      notifyError(getErrorMessage(e, 'Impossible de charger ton certificat'));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleShare = async () => {
    if (!certRef.current) return;
    setSharing(true);
    try {
      const uri = await captureRef(certRef, { format: 'png', quality: 1 });
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('Partage indisponible', "Le partage n'est pas disponible sur cet appareil.");
        return;
      }
      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: 'Partager mon certificat LASSI',
      });
    } catch (e) {
      notifyError(getErrorMessage(e, 'Impossible de partager le certificat'));
    } finally {
      setSharing(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: TOP_INSET + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.75}>
          <IcoBack />
        </TouchableOpacity>
        <Text style={styles.title}>Mon Certificat</Text>
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : !certificat ? (
        <View style={styles.empty}>
          <Svg width={44} height={44} viewBox="0 0 24 24" fill="none" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" stroke={colors.accent} />
            <Path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" stroke={colors.accent} />
            <Path d="M4 22h16" stroke={colors.accent} />
            <Path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" stroke={colors.accent} />
            <Path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" stroke={colors.accent} />
            <Path d="M18 2H6v7a6 6 0 0 0 12 0V2z" stroke={colors.accent} />
          </Svg>
          <Text style={styles.emptyTitle}>Pas encore débloqué</Text>
          <Text style={styles.emptyTxt}>
            Termine dans le Top 20 du classement national pour débloquer ton certificat officiel
            partageable.
          </Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          <ViewShot ref={certRef} style={styles.shot} options={{ format: 'png', quality: 1 }}>
            <View style={styles.cert}>
              <LassiLogo width={130} />
              <IcoCrown size={52} />
              <Text style={styles.certLabel}>CERTIFICAT OFFICIEL</Text>
              <Text style={styles.badgeTxt}>{certificat.badge}</Text>
              <Text style={styles.periode}>{formatPeriodeLabel(certificat.periode)}</Text>
              <View style={styles.divider} />
              <Text style={styles.shopName} numberOfLines={2}>
                {shopName}
              </Text>
              <View style={styles.rangPill}>
                <Text style={styles.rangTxt}>Rang #{certificat.rang}</Text>
              </View>
            </View>
          </ViewShot>

          <TouchableOpacity
            style={[styles.shareBtn, sharing && styles.shareBtnDisabled]}
            onPress={handleShare}
            disabled={sharing}
            activeOpacity={0.85}
          >
            <Text style={styles.shareBtnTxt}>{sharing ? 'Préparation…' : 'Partager'}</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 18,
  },

  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 10,
  },
  emptyIco: { marginBottom: 6 },
  emptyTitle: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 17,
  },
  emptyTxt: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },

  scroll: { paddingBottom: 32, paddingTop: 24, alignItems: 'center', flexGrow: 1 },

  shot: {
    backgroundColor: colors.bg,
  },
  cert: {
    width: 320,
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.accent,
    borderRadius: radius.xxl,
  },
  certLabel: {
    color: colors.muted,
    fontFamily: fonts.label,
    fontSize: 11,
    letterSpacing: 2,
    marginTop: 14,
  },
  badgeTxt: {
    color: colors.accent,
    fontFamily: fonts.titleXL,
    fontSize: 19,
    textAlign: 'center',
    marginTop: 10,
  },
  periode: {
    color: colors.white,
    fontFamily: fonts.ui,
    fontSize: 13,
    marginTop: 4,
  },
  divider: {
    width: '60%',
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 20,
  },
  shopName: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 20,
    textAlign: 'center',
  },
  rangPill: {
    marginTop: 16,
    paddingVertical: 6,
    paddingHorizontal: 18,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  rangTxt: {
    color: colors.bg,
    fontFamily: fonts.titleXL,
    fontSize: 14,
  },

  shareBtn: {
    marginTop: 28,
    width: 320,
    height: 50,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareBtnDisabled: { opacity: 0.6 },
  shareBtnTxt: {
    color: colors.bg,
    fontFamily: fonts.titleXL,
    fontSize: 15,
  },
});
