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
import { Image as ExpoImage } from 'expo-image';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts, TOP_INSET } from '../../theme';
import { CATEGORIES, getCatConfig, type CatId } from '../../config/categories';
import { createAdditionalShop } from '../../services/shops';
import useShopStore from '../../store/shopStore';

interface Props {
  visible: boolean;
  onClose: () => void;
  onCreated: (shopId: string) => void;
}

export default function AddAccountScreen({ visible, onClose, onCreated }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedCatId, setSelectedCatId] = useState<CatId | null>(null);
  const [selectedSubcats, setSelectedSubcats] = useState<string[]>([]);
  const [shopName, setShopName] = useState('');
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setStep(1);
    setSelectedCatId(null);
    setSelectedSubcats([]);
    setShopName('');
    setLoading(false);
  };

  const handleClose = () => { reset(); onClose(); };

  const handleBack = () => {
    if (step === 3) setStep(2);
    else if (step === 2) setStep(1);
    else handleClose();
  };

  const handleSelectCat = (catId: CatId) => {
    setSelectedCatId(catId);
    setSelectedSubcats([]);
    setStep(2);
  };

  const catConfig = selectedCatId ? getCatConfig(selectedCatId) : undefined;

  const toggleSubcat = (id: string) => {
    if (!catConfig) return;
    if (catConfig.subcatMode === 'single') {
      setSelectedSubcats([id]);
    } else {
      setSelectedSubcats(prev =>
        prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id],
      );
    }
  };

  const handleNextFromSubcats = () => {
    if (selectedSubcats.length === 0) {
      Alert.alert('Choisis au moins une spécialité');
      return;
    }
    setStep(3);
  };

  const handleCreate = async () => {
    if (!selectedCatId || !shopName.trim()) return;
    setLoading(true);
    try {
      const shop = await createAdditionalShop(shopName.trim(), selectedCatId, selectedSubcats);
      await useShopStore.getState().loadMyShops();
      reset();
      onCreated(shop.id);
    } catch (err: unknown) {
      Alert.alert('Erreur', err instanceof Error ? err.message : 'Impossible de créer le compte');
    } finally {
      setLoading(false);
    }
  };

  const selectedCatConfig = selectedCatId ? getCatConfig(selectedCatId) : undefined;

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={handleClose}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M15 18l-6-6 6-6" stroke={colors.white} />
            </Svg>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Nouveau compte</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Étape 1 — Catégorie */}
        {step === 1 && (
          <ScrollView contentContainerStyle={styles.listContent}>
            <Text style={styles.stepLabel}>Choisis une catégorie</Text>
            {CATEGORIES.map(cat => (
              <TouchableOpacity
                key={cat.id}
                style={styles.catCard}
                onPress={() => handleSelectCat(cat.id as CatId)}
                activeOpacity={0.8}
              >
                <View style={styles.catIconBox}>
                  {cat.renderIcon(colors.white, 26)}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.catLabel}>{cat.label}</Text>
                  <Text style={styles.catSub} numberOfLines={1}>
                    {cat.subcats.filter(s => !s.hidden).map(s => s.label).join(', ')}
                  </Text>
                </View>
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M9 18l6-6-6-6" stroke="#666" />
                </Svg>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Étape 2 — Sous-catégories */}
        {step === 2 && catConfig && (
          <ScrollView contentContainerStyle={styles.listContent}>
            <Text style={styles.stepLabel}>
              {catConfig.subcatMode === 'multiple' ? 'Tes spécialités' : 'Ton activité principale'}
            </Text>
            <Text style={styles.stepSub}>
              {catConfig.subcatMode === 'multiple'
                ? 'Coche tout ce que tu proposes.'
                : 'Choisis le type qui décrit le mieux ton commerce.'}
            </Text>
            {catConfig.subcats.filter(s => !s.hidden).map(sub => {
              const on = selectedSubcats.includes(sub.id);
              return (
                <TouchableOpacity
                  key={sub.id}
                  style={[styles.subcatCard, on && styles.subcatCardOn]}
                  onPress={() => toggleSubcat(sub.id)}
                  activeOpacity={0.8}
                >
                  {sub.SvgIcon ? (
                    <View style={styles.catIconBox}><sub.SvgIcon color={colors.white} /></View>
                  ) : sub.imageUri ? (
                    <ExpoImage source={sub.imageUri} style={styles.subcatImg} contentFit="cover" cachePolicy="memory-disk" transition={0} />
                  ) : (
                    <View style={styles.catIconBox}>
                      <Text style={styles.catEmoji}>{sub.emoji}</Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.catLabel, on && { color: colors.accent }]}>{sub.label}</Text>
                    <Text style={styles.catSub}>{sub.desc}</Text>
                  </View>
                  <View style={[
                    catConfig.subcatMode === 'multiple' ? styles.checkbox : styles.radio,
                    on && (catConfig.subcatMode === 'multiple' ? styles.checkboxOn : styles.radioOn),
                  ]}>
                    {on && (catConfig.subcatMode === 'multiple'
                      ? <Text style={styles.checkmark}>✓</Text>
                      : <View style={styles.radioDot} />
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              style={[styles.nextBtn, selectedSubcats.length === 0 && { opacity: 0.4 }]}
              onPress={handleNextFromSubcats}
              activeOpacity={0.8}
            >
              <Text style={styles.nextBtnText}>Suivant →</Text>
            </TouchableOpacity>
          </ScrollView>
        )}

        {/* Étape 3 — Nom boutique */}
        {step === 3 && (
          <View style={styles.step3}>
            <Text style={styles.stepLabel}>Nom de ta boutique</Text>
            <View style={styles.catChosen}>
              <View style={{ width: 28, height: 28 }}>
                {selectedCatConfig?.renderIcon(colors.accent, 22)}
              </View>
              <Text style={styles.catChosenText}> {selectedCatConfig?.label}</Text>
            </View>
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
              style={[styles.nextBtn, (!shopName.trim() || loading) && { opacity: 0.5 }]}
              onPress={handleCreate}
              disabled={!shopName.trim() || loading}
              activeOpacity={0.8}
            >
              {loading
                ? <ActivityIndicator color={colors.bg} />
                : <Text style={styles.nextBtnText}>Créer ce compte</Text>
              }
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
    paddingTop: TOP_INSET + 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e2038',
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontFamily: fonts.title, fontSize: 18, color: colors.white, textAlign: 'center' },
  stepLabel: { fontFamily: fonts.title, fontSize: 16, color: colors.white, marginBottom: 6, marginTop: 24, paddingHorizontal: 20 },
  stepSub: { fontSize: 13, color: colors.muted, marginBottom: 16, paddingHorizontal: 20 },
  listContent: { paddingBottom: 40 },
  catCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1e2038',
  },
  catIconBox: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  catEmoji: { fontSize: 22 },
  catLabel: { fontFamily: fonts.ui, fontSize: 15, color: colors.white },
  catSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  subcatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1e2038',
  },
  subcatCardOn: { backgroundColor: '#1a1c35' },
  subcatImg: { width: 40, height: 40, borderRadius: 8, marginRight: 14 },
  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 2, borderColor: '#555',
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  checkmark: { fontSize: 13, color: colors.bg, fontFamily: fonts.title },
  radio: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: '#555',
    alignItems: 'center', justifyContent: 'center',
  },
  radioOn: { borderColor: colors.accent },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },
  step3: { flex: 1, paddingHorizontal: 20 },
  catChosen: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  catChosenText: { fontSize: 15, color: colors.accent, fontFamily: fonts.ui },
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
  nextBtn: {
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 24,
  },
  nextBtnText: { fontFamily: fonts.title, fontSize: 16, color: colors.bg },
});
