import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { colors, fonts } from '../../theme';
import useShopStore from '../../store/shopStore';
import { CATEGORIES } from '../../config/categories';
import Avatar from '../../components/Avatar';

interface Props {
  visible: boolean;
  currentShopId: string | null;
  onClose: () => void;
  onSwitch: (shopId: string) => void;
  onAddAccount: () => void;
}

export default function AccountSwitcherModal({
  visible,
  currentShopId,
  onClose,
  onSwitch,
  onAddAccount,
}: Props) {
  const myShops = useShopStore(s => s.myShops);
  const loadMyShops = useShopStore(s => s.loadMyShops);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      setLoading(true);
      loadMyShops().finally(() => setLoading(false));
    }
  }, [visible]);

  const canAdd = myShops.length < 3;

  const getCatLabel = (catId: string): string => {
    const cat = CATEGORIES.find(c => c.id === catId);
    return cat?.label ?? catId;
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>Mes comptes</Text>

          {loading ? (
            <ActivityIndicator color={colors.accent} style={{ marginVertical: 32 }} />
          ) : (
            <FlatList
              data={myShops}
              keyExtractor={item => item.id}
              style={{ maxHeight: 320 }}
              renderItem={({ item }) => {
                const isActive = item.id === currentShopId;
                return (
                  <TouchableOpacity
                    style={[styles.accountRow, isActive && styles.accountRowActive]}
                    onPress={() => {
                      if (!isActive) {
                        onSwitch(item.id);
                        onClose();
                      }
                    }}
                    activeOpacity={isActive ? 1 : 0.7}
                  >
                    <View style={styles.avatarWrap}>
                      <Avatar
                        name={item.name}
                        imageUrl={item.logoUrl}
                        size={44}
                        variant="shop"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.shopName} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={styles.shopCat}>
                        {getCatLabel(item.category)}
                      </Text>
                    </View>
                    {isActive && (
                      <View style={styles.activeBadge}>
                        <Text style={styles.activeBadgeText}>Actif</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          )}

          {canAdd && (
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => {
                onClose();
                onAddAccount();
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.addBtnText}>+ Ajouter un compte</Text>
            </TouchableOpacity>
          )}
          {!canAdd && (
            <View style={styles.limitRow}>
              <Text style={styles.limitText}>Maximum 3 comptes atteint</Text>
            </View>
          )}

          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelText}>Fermer</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 32,
    paddingTop: 12,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#444',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    fontFamily: fonts.title,
    fontSize: 18,
    color: colors.white,
    textAlign: 'center',
    marginBottom: 16,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1e2038',
  },
  accountRowActive: { backgroundColor: '#1a1c35' },
  avatarWrap: { marginRight: 14 },
  shopName: { fontFamily: fonts.ui, fontSize: 15, color: colors.white },
  shopCat: { fontSize: 13, color: colors.muted, marginTop: 2 },
  activeBadge: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  activeBadgeText: { fontFamily: fonts.title, fontSize: 11, color: colors.bg },
  addBtn: {
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  addBtnText: { fontFamily: fonts.title, fontSize: 15, color: colors.bg },
  limitRow: { marginHorizontal: 20, marginTop: 16, alignItems: 'center' },
  limitText: { fontSize: 13, color: colors.muted },
  cancelBtn: { marginHorizontal: 20, marginTop: 12, paddingVertical: 12, alignItems: 'center' },
  cancelText: { fontSize: 15, color: colors.muted },
});
