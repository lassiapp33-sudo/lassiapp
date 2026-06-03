import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts, TOP_INSET } from '../../theme';
import AvisSection from '../../components/avis/AvisSection';
import useShopStore from '../../store/shopStore';
import useAuthStore from '../../store/authStore';
import { IcoBack } from '../../components/icons';

interface Props {
  onBack: () => void;
}

export default function MerchantAvisScreen({ onBack }: Props) {
  const shopId   = useShopStore(s => s.shopId);
  const shopName = useShopStore(s => s.profile.name);
  const userId   = useAuthStore(s => s.user?.id);

  if (!shopId) return null;

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: TOP_INSET + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.75}>
          <IcoBack />
        </TouchableOpacity>
        <Text style={styles.title}>Avis de ma boutique</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        <AvisSection
          shopId={shopId}
          shopName={shopName}
          currentUserId={userId}
          isMerchant
        />
      </ScrollView>
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

  scroll: { flexGrow: 1 },
});
