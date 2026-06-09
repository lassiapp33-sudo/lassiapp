import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActionSheetIOS,
  Platform,
  Linking,
} from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { colors, fonts, TOP_INSET } from '../../theme';
import useAuthStore from '../../store/authStore';
import useFavoritesStore from '../../store/favoritesStore';
import { formatPhoneSenegal } from '../../utils/phone';
import DeleteAccountModal from '../../components/common/DeleteAccountModal';
import LanguageModal from '../../components/common/LanguageModal';
import HelpScreen from './HelpScreen';
import * as storageService from '../../services/storage';
import * as authService from '../../services/auth';
import LassiScreen from '../../components/LassiScreen';
import { contacterServiceClient } from '../../config/contact';
import AProposScreen from '../common/AProposScreen';
import SignalerProblemeScreen from '../common/SignalerProblemeScreen';
import { useT } from '../../i18n';
import useLanguageStore from '../../store/languageStore';
import { IcoBack } from '../../components/icons';
import { ProfileOptionRow, profileRowStyles } from '../../components/common/ProfileOptionRow';
import { ProfileIdCard } from '../../components/common/ProfileIdCard';

// ─── Icônes ──────────────────────────────────────────────────────────────────


const IcoOrder = () => (
  <Svg
    width={18}
    height={18}
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" stroke={colors.accent} />
    <Path d="M3 6h18M16 10a4 4 0 0 1-8 0" stroke={colors.accent} />
  </Svg>
);

const IcoStar = () => (
  <Svg
    width={18}
    height={18}
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Path
      d="M12 17.8 5.8 21 7 14.1 2 9.3l7-1L12 2l3 6.3 7 1-5 4.8 1.2 6.9z"
      stroke={colors.accent}
    />
  </Svg>
);

const IcoCard = () => (
  <Svg
    width={18}
    height={18}
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Rect x={2} y={5} width={20} height={14} rx={2} stroke={colors.accent} />
    <Path d="M2 10h20" stroke={colors.accent} />
  </Svg>
);

const IcoBell = () => (
  <Svg
    width={18}
    height={18}
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" stroke={colors.accent} />
    <Path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" stroke={colors.accent} />
  </Svg>
);

const IcoGlobe = () => (
  <Svg
    width={18}
    height={18}
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Path d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2z" stroke={colors.accent} />
    <Path d="M2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20Z" stroke={colors.accent} />
  </Svg>
);

const IcoShare = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 2C6.48 2 2 6.48 2 12c0 1.85.5 3.58 1.37 5.07L2 22l5.07-1.35A9.96 9.96 0 0 0 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2z"
      fill={colors.accent}
    />
    <Path
      d="M16.5 14.5c-.28-.14-1.63-.8-1.88-.9-.25-.09-.43-.14-.61.14-.18.28-.7.9-.86 1.08-.16.18-.32.2-.6.07-.28-.14-1.17-.43-2.23-1.37-.82-.73-1.38-1.64-1.54-1.92-.16-.28-.02-.43.12-.57.13-.12.28-.32.42-.48.14-.16.18-.28.28-.46.09-.18.05-.34-.02-.48-.07-.14-.61-1.47-.84-2.01-.22-.53-.45-.46-.61-.47l-.52-.01c-.18 0-.46.07-.7.34-.25.27-.95.93-.95 2.26s.97 2.62 1.11 2.8c.13.18 1.91 2.92 4.64 4.1.65.28 1.16.45 1.55.57.65.21 1.24.18 1.71.11.52-.08 1.6-.66 1.83-1.29.22-.63.22-1.17.15-1.29-.06-.11-.24-.18-.52-.32z"
      fill={colors.bg}
    />
  </Svg>
);

const IcoHelp = () => (
  <Svg
    width={18}
    height={18}
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Path d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2z" stroke={colors.accent} />
    <Path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3" stroke={colors.accent} />
    <Path d="M12 17h.01" stroke={colors.accent} />
  </Svg>
);

const IcoInfo = () => (
  <Svg
    width={18}
    height={18}
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Path d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2z" stroke={colors.accent} />
    <Path d="M12 16v-4M12 8h.01" stroke={colors.accent} />
  </Svg>
);

const IcoFlag = () => (
  <Svg
    width={18}
    height={18}
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" stroke="#E07A7A" />
    <Path d="M4 22v-7" stroke="#E07A7A" />
  </Svg>
);

const IcoWhatsApp = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 2C6.48 2 2 6.48 2 12c0 1.85.5 3.58 1.37 5.07L2 22l5.07-1.35A9.96 9.96 0 0 0 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2z"
      fill={colors.accent}
    />
    <Path
      d="M16.5 14.5c-.28-.14-1.63-.8-1.88-.9-.25-.09-.43-.14-.61.14-.18.28-.7.9-.86 1.08-.16.18-.32.2-.6.07-.28-.14-1.17-.43-2.23-1.37-.82-.73-1.38-1.64-1.54-1.92-.16-.28-.02-.43.12-.57.13-.12.28-.32.42-.48.14-.16.18-.28.28-.46.09-.18.05-.34-.02-.48-.07-.14-.61-1.47-.84-2.01-.22-.53-.45-.46-.61-.47l-.52-.01c-.18 0-.46.07-.7.34-.25.27-.95.93-.95 2.26s.97 2.62 1.11 2.8c.13.18 1.91 2.92 4.64 4.1.65.28 1.16.45 1.55.57.65.21 1.24.18 1.71.11.52-.08 1.6-.66 1.83-1.29.22-.63.22-1.17.15-1.29-.06-.11-.24-.18-.52-.32z"
      fill={colors.bg}
    />
  </Svg>
);

const IcoTerrain = () => (
  <Svg
    width={18}
    height={18}
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Path d="M3 17l4-8 4 4 4-6 4 10H3z" stroke={colors.accent} />
    <Path d="M3 20h18" stroke={colors.accent} />
  </Svg>
);

const IcoLogout = () => (
  <Svg
    width={18}
    height={18}
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Path
      d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"
      stroke={colors.danger}
    />
  </Svg>
);

const IcoTrash = () => (
  <Svg
    width={18}
    height={18}
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Path d="M3 6h18M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke={colors.danger} />
    <Path d="M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" stroke={colors.danger} />
  </Svg>
);

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  onBack?: () => void;
  onOrders?: () => void;
  onFavorites?: () => void;
  onTerrainReservations?: () => void;
  onLogout?: () => void;
}

// ─── Écran ────────────────────────────────────────────────────────────────────

export default function ClientProfileScreen({ onBack, onOrders, onFavorites, onTerrainReservations, onLogout }: Props) {
  const t = useT();
  const lang = useLanguageStore(s => s.lang);

  const [notifOn, setNotifOn] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showLangModal, setShowLangModal] = useState(false);
  const [showAPropos, setShowAPropos] = useState(false);
  const [showSignaler, setShowSignaler] = useState(false);

  const user = useAuthStore(s => s.user);
  const updateProfile = useAuthStore(s => s.updateProfile);
  const favCount = useFavoritesStore(s => s.favorites.length);

  const displayName = user?.name ?? 'Client';
  const displayPhone = user?.phone ? formatPhoneSenegal(user.phone) : '';

  const favSubtitle =
    favCount > 0
      ? `${favCount} ${favCount > 1 ? t.profile.favoritesMany : t.profile.favoriteOne}`
      : t.profile.noFavorites;

  const pickAndUploadAvatar = async (source: 'gallery' | 'camera') => {
    if (!user?.id) return;
    const uri =
      source === 'gallery'
        ? await storageService.pickImageFromGallery()
        : await storageService.pickImageFromCamera();
    if (!uri) return;
    setUploading(true);
    try {
      const path = storageService.avatarPath(user.id);
      const url = await storageService.uploadImage('avatars', uri, path);
      await authService.updateAvatarUrl(user.id, url);
      updateProfile({ avatarUrl: url });
    } catch {
      Alert.alert(t.common.error, t.common.photoUpdateError);
    } finally {
      setUploading(false);
    }
  };

  const handleEditAvatar = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: [t.common.cancel, t.common.gallery, t.common.camera], cancelButtonIndex: 0 },
        idx => {
          if (idx === 1) pickAndUploadAvatar('gallery');
          if (idx === 2) pickAndUploadAvatar('camera');
        },
      );
    } else {
      Alert.alert(t.common.photoProfile, '', [
        { text: t.common.gallery, onPress: () => pickAndUploadAvatar('gallery') },
        { text: t.common.camera, onPress: () => pickAndUploadAvatar('camera') },
        { text: t.common.cancel, style: 'cancel' },
      ]);
    }
  };

  if (showHelp) return <HelpScreen onBack={() => setShowHelp(false)} role="client" />;
  if (showAPropos) return <AProposScreen onBack={() => setShowAPropos(false)} />;
  if (showSignaler)
    return <SignalerProblemeScreen onBack={() => setShowSignaler(false)} profil="client" />;

  return (
    <LassiScreen
      header={
        <View style={{ paddingTop: TOP_INSET + 6 }}>
          <View style={styles.topBar}>
            <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
              <IcoBack />
            </TouchableOpacity>
            <Text style={styles.pageTitle}>{t.profile.myProfile}</Text>
          </View>
          <ProfileIdCard
            name={displayName}
            phone={displayPhone}
            avatarUrl={user?.avatarUrl}
            avatarVariant="user"
            showBorder
            uploading={uploading}
            onEditAvatar={handleEditAvatar}
            chipLabel={t.profile.client}
            bottomSpacing={24}
          />
        </View>
      }
    >
      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 36, flexGrow: 1 }}
      >
        <Text style={profileRowStyles.secLbl}>{t.profile.myActivity}</Text>
        <View style={profileRowStyles.grp}>
          <ProfileOptionRow
            icon={<IcoOrder />}
            title={t.profile.myOrders}
            subtitle={t.profile.myOrdersSub}
            onPress={onOrders}
          />
          <ProfileOptionRow
            icon={<IcoStar />}
            title={t.profile.myFavorites}
            subtitle={favSubtitle}
            onPress={onFavorites}
          />
          <ProfileOptionRow
            icon={<IcoTerrain />}
            title="Mes terrains réservés"
            subtitle="Football, basketball & plus"
            onPress={onTerrainReservations}
          />
          <ProfileOptionRow
            icon={<IcoCard />}
            title={t.profile.myPayments}
            subtitle={t.profile.myPaymentsSub}
            last
            onPress={() => Alert.alert(t.common.comingSoon, t.common.paymentsComingSoon)}
          />
        </View>

        <Text style={profileRowStyles.secLbl}>{t.profile.preferences}</Text>
        <View style={profileRowStyles.grp}>
          <ProfileOptionRow
            icon={<IcoBell />}
            title={t.profile.notifications}
            end="toggle"
            toggled={notifOn}
            onToggle={() => setNotifOn(v => !v)}
          />
          <ProfileOptionRow
            icon={<IcoGlobe />}
            title={t.profile.language}
            subtitle={lang === 'fr' ? t.lang.fr : t.lang.en}
            onPress={() => setShowLangModal(true)}
          />
          <ProfileOptionRow
            icon={<IcoShare />}
            title={t.profile.inviteFriend}
            subtitle={t.profile.inviteFriendSub}
            last
            onPress={() =>
              Linking.openURL(
                'https://wa.me/?text=H%C3%A9%20!%20Essaie%20Lassi%2C%20l%27app%20pour%20commander%20tes%20services%20facilement.%20T%C3%A9l%C3%A9charge-la%20ici%20%3A%20https%3A%2F%2Fwww.lassi-app.com',
              )
            }
          />
        </View>

        <Text style={profileRowStyles.secLbl}>{t.profile.helpAccount}</Text>
        <View style={profileRowStyles.grp}>
          <ProfileOptionRow
            icon={<IcoHelp />}
            title={t.profile.helpSupport}
            onPress={() => setShowHelp(true)}
          />
          <ProfileOptionRow
            icon={<IcoFlag />}
            title="Signaler un problème"
            onPress={() => setShowSignaler(true)}
          />
          <ProfileOptionRow
            icon={<IcoInfo />}
            title="À propos"
            onPress={() => setShowAPropos(true)}
          />
          <ProfileOptionRow
            icon={<IcoWhatsApp />}
            title={t.profile.whatsapp}
            subtitle={t.profile.whatsappSub}
            end="arrow"
            onPress={() =>
              contacterServiceClient(
                "Bonjour Lassi, je suis un client et j'ai besoin d'aide avec mon compte.",
              )
            }
          />
          <ProfileOptionRow
            icon={<IcoLogout />}
            title={t.profile.logout}
            danger
            end="none"
            onPress={onLogout}
          />
          <ProfileOptionRow
            icon={<IcoTrash />}
            title={t.profile.deleteAccount}
            danger
            end="none"
            onPress={() => setShowDeleteModal(true)}
            last
          />
        </View>

        <Text style={profileRowStyles.version}>{t.profile.version}</Text>
      </ScrollView>

      <DeleteAccountModal
        visible={showDeleteModal}
        role="client"
        onClose={() => setShowDeleteModal(false)}
        onSuccess={() => {
          setShowDeleteModal(false);
          onLogout?.();
        }}
      />
      <LanguageModal visible={showLangModal} onClose={() => setShowLangModal(false)} />
    </LassiScreen>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scroll: { flex: 1 },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingBottom: 18,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  pageTitle: {
    color: colors.white,
    fontFamily: fonts.titleXL,
    fontSize: 22,
  },
});
