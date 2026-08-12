import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts, radius } from '../../theme';
import { StoreCategory, StoreProduct } from '../../types/store';
import { ParsedMenuItem } from '../../utils/menuParser';
import useShopStore from '../../store/shopStore';

// ─── Icônes ──────────────────────────────────────────────────────────────────

const IcoClose = () => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" strokeWidth={2} strokeLinecap="round">
    <Path d="M18 6 6 18M6 6l12 12" stroke={colors.white} />
  </Svg>
);

const IcoTrash = () => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="#ff5a5a" />
  </Svg>
);

// ─── Types locaux ─────────────────────────────────────────────────────────────

interface EditableItem extends ParsedMenuItem {
  priceStr: string; // chaîne éditable du prix
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  items: ParsedMenuItem[];
  categories: StoreCategory[];
  onClose: () => void;
  onPublished: () => void;
}

// ─── Composant ───────────────────────────────────────────────────────────────

export default function ScanMenuReviewSheet({
  visible,
  items,
  categories,
  onClose,
  onPublished,
}: Props) {
  const saveProduct = useShopStore(s => s.saveProduct);
  const shopType = useShopStore(s => s.context.shopType);

  const [editItems, setEditItems] = useState<EditableItem[]>([]);
  const [saving, setSaving] = useState(false);

  // Synchro quand les items changent (nouvelle session OCR)
  useEffect(() => {
    if (visible) {
      setEditItems(
        items.map(it => ({
          ...it,
          priceStr: it.price !== null ? String(it.price) : '',
        })),
      );
    }
  }, [visible, items]);

  const updateName = (id: string, name: string) => {
    setEditItems(prev => prev.map(it => (it.id === id ? { ...it, name } : it)));
  };

  const updatePrice = (id: string, priceStr: string) => {
    setEditItems(prev => prev.map(it => (it.id === id ? { ...it, priceStr } : it)));
  };

  const removeItem = (id: string) => {
    setEditItems(prev => prev.filter(it => it.id !== id));
  };

  const validItems = editItems.filter(it => it.name.trim().length >= 2);

  const handlePublish = async () => {
    if (validItems.length === 0) {
      Alert.alert('Liste vide', 'Ajoute au moins un produit avec un nom avant de publier.');
      return;
    }

    const defaultCatId = categories[0]?.id ?? '';
    const itemType =
      shopType === 'services' ? 'service' : shopType === 'memberships' ? 'membership' : 'product';

    setSaving(true);
    let failed = 0;

    for (const item of validItems) {
      const price = parseInt(item.priceStr.replace(/\s/g, ''), 10);
      const product: StoreProduct = {
        id: `scan_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        emoji: '',
        name: item.name.trim(),
        desc: '',
        price: Number.isFinite(price) && price > 0 ? price : 0,
        category: defaultCatId,
        stock: 'in',
        itemType,
      };
      try {
        await saveProduct(product);
      } catch {
        failed++;
      }
    }

    setSaving(false);

    if (failed > 0) {
      Alert.alert(
        'Publication partielle',
        `${validItems.length - failed} produit(s) ajouté(s). ${failed} erreur(s) — réessaie pour les autres.`,
      );
    } else {
      Alert.alert(
        'Catalogue mis à jour !',
        `${validItems.length} produit(s) ajouté(s). Tu peux compléter les détails (photos, catégorie, description) depuis ta boutique.`,
        [{ text: 'OK', onPress: onPublished }],
      );
      return;
    }
    onPublished();
  };

  const SAFE_TOP = Platform.OS === 'ios' ? 56 : 20;
  const SAFE_BOT = Platform.OS === 'ios' ? 34 : 16;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.bg }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: SAFE_TOP }]}>
          <View>
            <Text style={styles.title}>Vérifier avant publication</Text>
            <Text style={styles.headerSub}>
              {editItems.length} élément{editItems.length > 1 ? 's' : ''} détecté{editItems.length > 1 ? 's' : ''}
            </Text>
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.8}>
            <IcoClose />
          </TouchableOpacity>
        </View>

        <Text style={styles.instruction}>
          Corrige les noms et prix si nécessaire, supprime ce qui n'est pas un produit.
        </Text>

        {/* Liste */}
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
          {editItems.map((item, index) => (
            <View key={item.id} style={styles.itemRow}>
              <View style={styles.itemIndex}>
                <Text style={styles.indexTxt}>{index + 1}</Text>
              </View>

              <View style={styles.itemFields}>
                <TextInput
                  style={styles.nameInput}
                  value={item.name}
                  onChangeText={v => updateName(item.id, v)}
                  placeholder="Nom du produit"
                  placeholderTextColor={colors.muted}
                />
                <View style={styles.priceRow}>
                  <TextInput
                    style={styles.priceInput}
                    value={item.priceStr}
                    onChangeText={v => updatePrice(item.id, v.replace(/[^0-9]/g, ''))}
                    placeholder="Prix"
                    placeholderTextColor={colors.muted}
                    keyboardType="numeric"
                  />
                  <Text style={styles.currencyTag}>FCFA</Text>
                </View>
              </View>

              <TouchableOpacity style={styles.deleteBtn} onPress={() => removeItem(item.id)} activeOpacity={0.7}>
                <IcoTrash />
              </TouchableOpacity>
            </View>
          ))}

          {editItems.length === 0 && (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTxt}>Tous les éléments ont été supprimés.</Text>
            </View>
          )}
        </ScrollView>

        {/* Footer */}
        <View style={[styles.footer, { paddingBottom: SAFE_BOT }]}>
          {validItems.length > 0 && (
            <Text style={styles.footerNote}>
              {validItems.filter(it => !it.priceStr || it.priceStr === '0').length > 0
                ? '⚠️ Certains produits n\'ont pas de prix — tu pourras les ajouter depuis la boutique.'
                : null}
            </Text>
          )}
          <TouchableOpacity
            style={[styles.publishBtn, (saving || validItems.length === 0) && styles.publishBtnDisabled]}
            onPress={handlePublish}
            disabled={saving || validItems.length === 0}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator color={colors.bg} size="small" />
            ) : (
              <Text style={styles.publishTxt}>
                Publier {validItems.length} produit{validItems.length > 1 ? 's' : ''}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { color: colors.white, fontFamily: fonts.title, fontSize: 17 },
  headerSub: { color: colors.muted, fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  closeBtn: {
    width: 40, height: 40, borderRadius: radius.sm,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },

  instruction: {
    color: colors.muted, fontFamily: fonts.body, fontSize: 13,
    paddingHorizontal: 20, paddingVertical: 12,
  },

  list: { paddingHorizontal: 16, paddingBottom: 12, gap: 10 },

  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.border,
    padding: 12,
    gap: 10,
  },
  itemIndex: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: `${colors.accent}20`,
    alignItems: 'center', justifyContent: 'center',
  },
  indexTxt: { color: colors.accent, fontFamily: fonts.title, fontSize: 11 },

  itemFields: { flex: 1, gap: 6 },
  nameInput: {
    color: colors.white, fontFamily: fonts.body, fontSize: 14,
    backgroundColor: colors.bg,
    borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 10, paddingVertical: 7,
  },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  priceInput: {
    flex: 1,
    color: colors.white, fontFamily: fonts.body, fontSize: 14,
    backgroundColor: colors.bg,
    borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 10, paddingVertical: 7,
  },
  currencyTag: {
    color: colors.muted, fontFamily: fonts.body, fontSize: 12,
    paddingHorizontal: 8, paddingVertical: 7,
    backgroundColor: colors.bg,
    borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border,
  },

  deleteBtn: { padding: 6 },

  emptyBox: { alignItems: 'center', paddingVertical: 40 },
  emptyTxt: { color: colors.muted, fontFamily: fonts.body, fontSize: 14 },

  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 8,
  },
  footerNote: { color: colors.muted, fontFamily: fonts.body, fontSize: 12 },
  publishBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.lg,
    paddingVertical: 15,
    alignItems: 'center',
  },
  publishBtnDisabled: { opacity: 0.4 },
  publishTxt: { color: colors.bg, fontFamily: fonts.titleXL, fontSize: 15 },
});
