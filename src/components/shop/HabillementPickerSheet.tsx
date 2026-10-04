import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Pressable,
} from 'react-native';
import { colors, fonts, radius } from '../../theme';
import { formatPrice } from '../../utils/format';

interface Props {
  visible: boolean;
  productName: string;
  sizes: string[];
  colors: string[];
  stockQuantity?: number;
  onConfirm: (size: string | undefined, color: string | undefined) => void;
  onClose: () => void;
}

export default function HabillementPickerSheet({
  visible,
  productName,
  sizes,
  colors: colorList,
  stockQuantity,
  onConfirm,
  onClose,
}: Props) {
  const [selectedSize, setSelectedSize] = useState<string | undefined>(undefined);
  const [selectedColor, setSelectedColor] = useState<string | undefined>(undefined);

  const hasSizes = sizes.length > 0;
  const hasColors = colorList.length > 0;

  const canConfirm =
    (!hasSizes || selectedSize !== undefined) &&
    (!hasColors || selectedColor !== undefined);

  const handleConfirm = () => {
    if (!canConfirm) return;
    onConfirm(selectedSize, selectedColor);
    setSelectedSize(undefined);
    setSelectedColor(undefined);
  };

  const handleClose = () => {
    setSelectedSize(undefined);
    setSelectedColor(undefined);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <Pressable style={styles.overlay} onPress={handleClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.header}>
            <Text style={styles.title}>Choisir la taille &amp; la couleur</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={handleClose} activeOpacity={0.7}>
              <Text style={styles.closeTxt}>✕</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.productName} numberOfLines={2}>{productName}</Text>

          {stockQuantity != null && (
            <Text style={[styles.stockTxt, stockQuantity <= 5 && styles.stockLow]}>
              {stockQuantity} restant{stockQuantity > 1 ? 's' : ''}
            </Text>
          )}

          {hasSizes && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Taille</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                {sizes.map(size => {
                  const active = selectedSize === size;
                  return (
                    <TouchableOpacity
                      key={size}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => setSelectedSize(size)}
                      activeOpacity={0.75}
                    >
                      <Text style={[styles.chipTxt, active && styles.chipTxtActive]}>{size}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {hasColors && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Couleur</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                {colorList.map(color => {
                  const active = selectedColor === color;
                  return (
                    <TouchableOpacity
                      key={color}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => setSelectedColor(color)}
                      activeOpacity={0.75}
                    >
                      <Text style={[styles.chipTxt, active && styles.chipTxtActive]}>{color}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          <TouchableOpacity
            style={[styles.confirmBtn, !canConfirm && styles.confirmBtnDisabled]}
            onPress={handleConfirm}
            activeOpacity={0.85}
            disabled={!canConfirm}
          >
            <Text style={styles.confirmTxt}>Ajouter au panier</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#1a1b38',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 36,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  title: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 16,
    flex: 1,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#2a2b4a',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  closeTxt: {
    color: '#7b7d9d',
    fontSize: 13,
    lineHeight: 16,
  },
  productName: {
    color: '#7b7d9d',
    fontFamily: fonts.body,
    fontSize: 13,
    marginBottom: 4,
  },
  stockTxt: {
    color: '#7b7d9d',
    fontFamily: fonts.body,
    fontSize: 11,
    marginBottom: 12,
  },
  stockLow: {
    color: '#F97316',
  },
  section: {
    marginBottom: 18,
  },
  sectionLabel: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 13,
    marginBottom: 10,
  },
  chipRow: {
    flexDirection: 'row',
  },
  chip: {
    borderWidth: 1,
    borderColor: '#FDCF34',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 14,
    marginRight: 8,
  },
  chipActive: {
    backgroundColor: '#FDCF34',
  },
  chipTxt: {
    color: '#FDCF34',
    fontFamily: fonts.body,
    fontSize: 13,
  },
  chipTxtActive: {
    color: '#14152A',
    fontFamily: fonts.title,
  },
  confirmBtn: {
    backgroundColor: '#FDCF34',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 6,
  },
  confirmBtnDisabled: {
    opacity: 0.4,
  },
  confirmTxt: {
    color: '#14152A',
    fontFamily: fonts.title,
    fontSize: 15,
  },
});
