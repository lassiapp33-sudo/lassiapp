import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import StoreHeader     from '../../components/store/StoreHeader';
import ShopProfileCard from '../../components/store/ShopProfileCard';
import CategoryTabs    from '../../components/store/CategoryTabs';
import ProductRow      from '../../components/store/ProductRow';
import AddProductSheet from '../../components/store/AddProductSheet';
import { colors, fonts } from '../../theme';
import { StoreProduct } from '../../types/store';
import useShopStore from '../../store/shopStore';

// ─── Sous-composant : en-tête de section ─────────────────────────────────────

function SectionHead({ title, count }: { title: string; count: number }) {
  return (
    <View style={styles.sec}>
      <Text style={styles.secTitle}>{title}</Text>
      <Text style={styles.secCount}>{count} produit{count > 1 ? 's' : ''}</Text>
    </View>
  );
}

// ─── Bouton "Ajouter un produit" ──────────────────────────────────────────────

const IcoPlus = () => (
  <Svg width={19} height={19} viewBox="0 0 24 24" fill="none" strokeWidth={2.2} strokeLinecap="round">
    <Path d="M12 5v14M5 12h14" stroke={colors.accent} />
  </Svg>
);

// ─── Écran principal ──────────────────────────────────────────────────────────

interface Props {
  onBack:    () => void;
  onPreview?: () => void;   // → ShopScreen côté client (aperçu)
}

export default function StoreScreen({ onBack, onPreview }: Props) {
  const profile     = useShopStore(s => s.profile);
  const categories  = useShopStore(s => s.categories);
  const products    = useShopStore(s => s.products);
  const updateProfile = useShopStore(s => s.updateProfile);
  const saveProduct   = useShopStore(s => s.saveProduct);
  const toggleStock   = useShopStore(s => s.toggleStock);

  const [activeCat,  setActiveCat]  = useState('petitdej');
  const [editTarget, setEditTarget] = useState<StoreProduct | null>(null);
  const [showSheet,  setShowSheet]  = useState(false);

  // Produits de la catégorie active
  const activeCatData = categories.find(c => c.id === activeCat);
  const filtered      = products.filter(p => p.category === activeCat);

  const openEdit = (product: StoreProduct) => { setEditTarget(product); setShowSheet(true); };
  const openAdd  = () => { setEditTarget(null); setShowSheet(true); };

  // Sauvegarder via le store (persisté)
  const handleSave = (p: StoreProduct) => saveProduct(p);

  return (
    <View style={styles.root}>
      <StoreHeader onBack={onBack} onPreview={onPreview ?? (() => {})} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ① Carte profil boutique + toggle ouvert/fermé */}
        <ShopProfileCard
          profile={profile}
          onToggle={() => updateProfile({ isOpen: !profile.isOpen })}
          onEditLogo={() => { /* TODO : picker photo logo */ }}
        />

        {/* ② Onglets catégories internes */}
        <CategoryTabs
          categories={categories}
          active={activeCat}
          onSelect={setActiveCat}
        />

        {/* ③ Section + liste des produits */}
        <SectionHead
          title={`${activeCatData?.emoji ?? ''} ${activeCatData?.label ?? ''}`}
          count={filtered.length}
        />

        {filtered.map(product => (
          <ProductRow
            key={product.id}
            product={product}
            onEdit={() => openEdit(product)}
            onToggleStock={() => toggleStock(product.id)}
          />
        ))}

        {/* ④ Bouton ajouter un produit */}
        <TouchableOpacity style={styles.addProd} onPress={openAdd} activeOpacity={0.8}>
          <IcoPlus />
          <Text style={styles.addProdTxt}>Ajouter un produit</Text>
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* ⑤ Bottom sheet ajout / édition */}
      <AddProductSheet
        visible={showSheet}
        product={editTarget}
        categories={categories}
        onSave={handleSave}
        onClose={() => setShowSheet(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  content: { paddingTop: 4, flexGrow: 1 },

  // En-tête de section produits
  sec: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 12,
  },
  secTitle: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 15,
  },
  secCount: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11.5,
  },

  // Bouton "Ajouter un produit" (dashed border)
  addProd: {
    marginHorizontal: 18,
    marginTop: 2,
    height: 52,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addProdTxt: {
    color: colors.accent,
    fontFamily: fonts.title,
    fontSize: 14,
  },
});
