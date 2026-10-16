import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts } from '../../theme';
import { CATEGORIES } from '../../config/categories';
import { createAdditionalShop } from '../../services/shops';
import useShopStore from '../../store/shopStore';

interface Props {
  visible: boolean;
  onClose: () => void;
  onCreated: (shopId: string) => void;
}

export default function AddAccountScreen({ visible, onClose, onCreated }: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [shopName, setShopName] = useState('');
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setStep(1);
    setSelectedCat(null);
    setShopName('');
    setLoading(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSelectCat = (catId: string) => {
    setSelectedCat(catId);
    setStep(2);
  };

  const handleCreate = async () => {
    if (!selectedCat || !shopName.trim()) return;
    setLoading(true);
    try {
      const shop = await createAdditionalShop(shopName.trim(), selectedCat);
      await useShopStore.getState().loadMyShops();
      reset();
      onCreated(shop.id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Impossible de créer le compte';
      Alert.alert('Erreur', msg);
    } finally {
      setLoading(false);
    }
  };

  const selectedCatConfig = CATEGORIES.find(c => c.id === selectedCat);

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={handleClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={step === 2 ? () => setStep(1) : handleClose}
            style={styles.backBtn}
          >
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M15 18l-6-6 6-6" stroke={colors.white} />
            </Svg>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Nouveau compte</Text>
          <View style={{ width: 40 }} />
        </View>

        {step === 1 && (
          <ScrollView contentContainerStyle={styles.catGrid}>
            <Text style={styles.stepLabel}>Choisis une catégorie</Text>
            {CATEGORIES.map(cat => (
              <TouchableOpacity
                key={cat.id}
                style={styles.catCard}
                onPress={() => handleSelectCat(cat.id)}
                activeOpacity={0.8}
              >
                <Text style={styles.catEmoji}>{cat.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.catLabel}>{cat.label}</Text>
                </View>
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M9 18l6-6-6-6" stroke="#666" />
                </Svg>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {step === 2 && (
          <View style={styles.step2}>
            <Text style={styles.stepLabel}>Nom de ta boutique</Text>
            <Text style={styles.catChosen}>
              {selectedCatConfig?.emoji} {selectedCatConfig?.label}
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: Resto Chez Fatou"
              placeholderTextColor="#555"
              value={shopName}
              onChangeText={setShopName}
              autoFocus
              maxLength={40}
            />
            <Text style={styles.hint}>Ton numéro et tes infos restent les mêmes.</Text>
            <TouchableOpacity
              style={[styles.createBtn, (!shopName.trim() || loading) && { opacity: 0.5 }]}
              onPress={handleCreate}
              disabled={!shopName.trim() || loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color={colors.bg} />
              ) : (
                <Text style={styles.createBtnText}>Créer ce compte</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e2038',
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: {
    flex: 1,
    fontFamily: fonts.title,
    fontSize: 18,
    color: colors.white,
    textAlign: 'center',
  },
  stepLabel: {
    fontFamily: fonts.title,
    fontSize: 16,
    color: colors.white,
    marginBottom: 20,
    marginTop: 24,
    paddingHorizontal: 20,
  },
  catGrid: { paddingBottom: 32 },
  catCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e2038',
  },
  catEmoji: { fontSize: 28, marginRight: 16, width: 40, textAlign: 'center' },
  catLabel: { fontFamily: fonts.ui, fontSize: 15, color: colors.white },
  step2: { flex: 1, paddingHorizontal: 20 },
  catChosen: {
    fontSize: 15,
    color: colors.accent,
    marginBottom: 20,
    fontFamily: fonts.ui,
  },
  input: {
    backgroundColor: '#1a1c35',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.white,
    borderWidth: 1,
    borderColor: '#2a2d4a',
    marginBottom: 12,
  },
  hint: { fontSize: 13, color: '#666', marginBottom: 32 },
  createBtn: {
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  createBtnText: { fontFamily: fonts.title, fontSize: 16, color: colors.bg },
});
