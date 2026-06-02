import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, fonts } from '../../theme';
import { StoreCategory } from '../../types/store';

interface Props {
  categories:   StoreCategory[];
  active:       string;
  onSelect:     (id: string) => void;
  onAddCat?:    (label: string) => void;
  onDeleteCat?: (id: string) => void;
}

export default function CategoryTabs({ categories, active, onSelect, onAddCat, onDeleteCat }: Props) {
  const [isAdding, setIsAdding] = useState(false);
  const [draft,    setDraft]    = useState('');

  const confirmAdd = () => {
    const trimmed = draft.trim();
    if (trimmed) onAddCat?.(trimmed);
    setDraft('');
    setIsAdding(false);
  };

  const cancelAdd = () => {
    setDraft('');
    setIsAdding(false);
  };

  return (
    <View style={styles.container}>
      {categories.map(cat => {
        const on = cat.id === active;
        return (
          <View key={cat.id} style={styles.row}>
            <TouchableOpacity
              style={[styles.tab, on && styles.tabOn]}
              onPress={() => onSelect(cat.id)}
              activeOpacity={0.75}
            >
              <Text style={[styles.tabTxt, on ? styles.tabTxtOn : styles.tabTxtOff]}>
                {cat.label}
              </Text>
            </TouchableOpacity>
            {categories.length > 1 && onDeleteCat && (
              <TouchableOpacity
                style={styles.delBtn}
                onPress={() => onDeleteCat(cat.id)}
                activeOpacity={0.7}
              >
                <Text style={styles.delTxt}>×</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      })}

      {isAdding ? (
        <View style={styles.addRow}>
          <TextInput
            style={styles.addInput}
            value={draft}
            onChangeText={setDraft}
            placeholder="Nom du menu…"
            placeholderTextColor="#5a5c80"
            autoFocus
            returnKeyType="done"
            onSubmitEditing={confirmAdd}
          />
          <TouchableOpacity style={styles.confirmBtn} onPress={confirmAdd} activeOpacity={0.7}>
            <Text style={styles.confirmTxt}>✓</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={cancelAdd} activeOpacity={0.7}>
            <Text style={styles.cancelTxt}>✕</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setIsAdding(true)}
          activeOpacity={0.75}
        >
          <Text style={styles.addBtnTxt}>+ Nouveau menu</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 18,
    paddingBottom: 14,
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tab: {
    flex: 1,
    height: 46,
    paddingHorizontal: 14,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabOn: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  tabTxt: {
    fontFamily: fonts.title,
    fontSize: 13,
    flex: 1,
  },
  tabTxtOn:  { color: colors.bg    },
  tabTxtOff: { color: colors.muted },

  delBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,90,90,.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,90,90,.25)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  delTxt: {
    color: '#ff5a5a',
    fontSize: 20,
    lineHeight: 22,
    fontFamily: fonts.ui,
  },

  addBtn: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnTxt: {
    color: colors.accent,
    fontFamily: fonts.title,
    fontSize: 13,
  },

  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addInput: {
    flex: 1,
    height: 46,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.accent,
    borderRadius: 12,
    paddingHorizontal: 14,
    color: colors.white,
    fontFamily: fonts.body,
    fontSize: 13,
  },
  confirmBtn: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmTxt: {
    color: colors.bg,
    fontSize: 18,
    fontFamily: fonts.title,
  },
  cancelBtn: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelTxt: {
    color: colors.muted,
    fontSize: 16,
    fontFamily: fonts.ui,
  },
});
