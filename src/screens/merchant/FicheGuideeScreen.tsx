import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, SafeAreaView,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import SelecteurPuces from '../../components/store/SelecteurPuces';
import { getToutesSuggestions } from '../../services/ficheGuidee';
import { creerProduitsEnMasse } from '../../services/products';
import useShopStore from '../../store/shopStore';

// ─── Icône retour ─────────────────────────────────────────────────────────────

const IcoBack = () => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M19 12H5M12 19l-7-7 7-7" stroke="#EDEEF7" />
  </Svg>
);

// ─── Types ────────────────────────────────────────────────────────────────────

interface LigneProduit {
  id:           string;
  sousCategorie: string;
  nom:           string;
  prix:          string;
  description:   string;
}

function nouvelleLigne(): LigneProduit {
  return { id: `l-${Date.now()}-${Math.random()}`, sousCategorie: '', nom: '', prix: '', description: '' };
}

// ─── Écran ────────────────────────────────────────────────────────────────────

interface Props {
  onClose: () => void;
}

export default function FicheGuideeScreen({ onClose }: Props) {
  const shopId         = useShopStore(s => s.shopId);
  const shopType       = useShopStore(s => s.context.shopType);
  const subcategories  = useShopStore(s => s.context.subcategories);
  const categories     = useShopStore(s => s.categories);
  const loadMyShop     = useShopStore(s => s.loadMyShop);
  // Suggestions chargées pour la sous-catégorie principale du marchand
  const sousCatId      = subcategories[0] ?? '';

  const [loading,     setLoading]     = useState(true);
  const [suggestions, setSuggestions] = useState<{
    typeContenu: { id: string; valeur: string }[];
    sousCategorie: { id: string; valeur: string }[];
    nomProduit: { id: string; valeur: string }[];
    prix: { id: string; valeur: string }[];
  }>({ typeContenu: [], sousCategorie: [], nomProduit: [], prix: [] });

  const [typeContenu, setTypeContenu] = useState('');
  const [catId,       setCatId]       = useState(categories[0]?.id ?? '');
  const [lignes,      setLignes]      = useState<LigneProduit[]>([nouvelleLigne()]);
  const [envoi,       setEnvoi]       = useState(false);

  useEffect(() => {
    if (!sousCatId) { setLoading(false); return; }
    getToutesSuggestions(sousCatId)
      .then(setSuggestions)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [sousCatId]);

  const modifierLigne = (id: string, champ: keyof LigneProduit, valeur: string) => {
    setLignes(prev => prev.map(l => l.id === id ? { ...l, [champ]: valeur } : l));
  };

  const ajouterLigne = () => {
    setLignes(prev => [...prev, nouvelleLigne()]);
  };

  const supprimerLigne = (id: string) => {
    setLignes(prev => prev.filter(l => l.id !== id));
  };

  const publier = async () => {
    const valides = lignes.filter(l => l.nom.trim() && l.prix.trim());
    if (valides.length === 0) {
      Alert.alert('Rien à publier', 'Ajoutez au moins un produit avec un nom et un prix.');
      return;
    }
    if (!shopId) {
      Alert.alert('Erreur', 'Boutique non chargée. Ferme et réouvre la page.');
      return;
    }

    const itemType =
      shopType === 'services'    ? ('service'    as const) :
      shopType === 'memberships' ? ('membership' as const) :
                                   ('product'    as const);

    setEnvoi(true);
    try {
      await creerProduitsEnMasse(shopId, valides.map(l => ({
        nom:           l.nom.trim(),
        prix:          parseInt(l.prix.replace(/\D/g, ''), 10),
        description:   l.description.trim(),
        sousCategorie: l.sousCategorie,
        category:      catId,
        itemType,
      })));
      await loadMyShop();
      Alert.alert(
        '✅ Fiche publiée',
        `${valides.length} produit${valides.length > 1 ? 's' : ''} ajouté${valides.length > 1 ? 's' : ''}.`,
        [{ text: 'OK', onPress: onClose }],
      );
    } catch {
      Alert.alert('Erreur', 'Publication impossible. Réessayez.');
    } finally {
      setEnvoi(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={s.centered}>
        <ActivityIndicator color="#FDCF34" size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={onClose} style={s.backBtn} activeOpacity={0.7}>
          <IcoBack />
        </TouchableOpacity>
        <View>
          <Text style={s.title}>📝 Fiche Guidée</Text>
          <Text style={s.subtitle}>Choisissez ou écrivez librement</Text>
        </View>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Section 1 — Type de contenu (commun à tous les produits) */}
        <SelecteurPuces
          label="Type de contenu"
          suggestions={suggestions.typeContenu}
          valeurSelectionnee={typeContenu}
          onSelectionner={setTypeContenu}
          placeholderLibre="Ex : Menu, Catalogue, Tarifs…"
        />

        {/* Catégorie cible (onglet du catalogue) */}
        {categories.length > 1 && (
          <View style={s.catSection}>
            <Text style={s.label}>Ajouter dans</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={s.catRow}>
                {categories.map(cat => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[s.catChip, catId === cat.id && s.catChipActive]}
                    onPress={() => setCatId(cat.id)}
                    activeOpacity={0.75}
                  >
                    <Text style={[s.catChipTxt, catId === cat.id && s.catChipTxtActive]}>
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        )}

        {/* Une carte par produit */}
        {lignes.map((ligne) => (
          <View key={ligne.id} style={s.carteProduit}>

            {/* Section 2 — Sous-catégorie */}
            <SelecteurPuces
              label="Catégorie du produit"
              suggestions={suggestions.sousCategorie}
              valeurSelectionnee={ligne.sousCategorie}
              onSelectionner={(v) => modifierLigne(ligne.id, 'sousCategorie', v)}
              placeholderLibre="Ex : Repas, Boisson, Soin…"
            />

            {/* Section 3 — Nom du produit */}
            <SelecteurPuces
              label="Nom du produit"
              suggestions={suggestions.nomProduit}
              valeurSelectionnee={ligne.nom}
              onSelectionner={(v) => modifierLigne(ligne.id, 'nom', v)}
              placeholderLibre="Nom de votre produit"
            />

            {/* Section 4 — Prix */}
            <SelecteurPuces
              label="Prix (FCFA)"
              suggestions={suggestions.prix}
              valeurSelectionnee={ligne.prix}
              onSelectionner={(v) => modifierLigne(ligne.id, 'prix', v)}
              placeholderLibre="Prix en F CFA"
            />

            {/* Section 5 — Description : 100% libre, aucune suggestion */}
            <View style={{ marginBottom: 10 }}>
              <Text style={s.label}>Description <Text style={s.optionnel}>(optionnel)</Text></Text>
              <TextInput
                style={s.inputDescription}
                value={ligne.description}
                onChangeText={(v) => modifierLigne(ligne.id, 'description', v)}
                placeholder="Décrivez votre produit…"
                placeholderTextColor="#6B6F9E"
                multiline
                textAlignVertical="top"
              />
            </View>

            {lignes.length > 1 && (
              <TouchableOpacity onPress={() => supprimerLigne(ligne.id)} activeOpacity={0.7}>
                <Text style={s.supprimerLigne}>🗑️ Retirer ce produit</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}

        {/* Ajouter une ligne */}
        <TouchableOpacity style={s.btnAjouterProduit} onPress={ajouterLigne} activeOpacity={0.8}>
          <Text style={s.btnAjouterProduitText}>+ Ajouter un autre produit</Text>
        </TouchableOpacity>

        {/* Publier */}
        <TouchableOpacity
          style={[s.btnPublier, envoi && { opacity: 0.6 }]}
          onPress={publier}
          disabled={envoi}
          activeOpacity={0.85}
        >
          {envoi
            ? <ActivityIndicator color="#14152A" />
            : <Text style={s.btnPublierText}>✅ Publier ma fiche</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: '#14152A' },
  centered:{ flex: 1, backgroundColor: '#14152A', justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2C52',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1E2040',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title:   { color: '#FDCF34', fontFamily: 'PoppinsSemiBold', fontSize: 18 },
  subtitle:{ color: '#9A9EC4', fontSize: 12, marginTop: 2 },

  scroll:  { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },

  label:   { color: '#EDEEF7', fontFamily: 'PoppinsSemiBold', fontSize: 14, marginBottom: 10 },
  optionnel: { color: '#6B6F9E', fontFamily: 'PoppinsRegular', fontSize: 12 },

  // Catégorie cible
  catSection: { marginBottom: 20 },
  catRow:    { flexDirection: 'row', gap: 8 },
  catChip:   {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2A2C52',
    backgroundColor: '#1E2040',
  },
  catChipActive: { backgroundColor: 'rgba(253,207,52,.12)', borderColor: '#FDCF34' },
  catChipTxt:    { color: '#9A9EC4', fontSize: 13 },
  catChipTxtActive: { color: '#FDCF34', fontFamily: 'PoppinsSemiBold' },

  // Carte produit
  carteProduit: {
    backgroundColor: '#1E2040',
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2A2C52',
  },
  inputDescription: {
    backgroundColor: '#14152A',
    borderRadius: 12,
    padding: 12,
    color: '#EDEEF7',
    borderWidth: 1,
    borderColor: '#2A2C52',
    minHeight: 70,
  },
  supprimerLigne: { color: '#E07A7A', fontSize: 12, marginTop: 4 },

  btnAjouterProduit: {
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A2C52',
    borderRadius: 14,
    borderStyle: 'dashed',
    marginBottom: 16,
  },
  btnAjouterProduitText: { color: '#9A9EC4', fontSize: 13 },

  btnPublier: {
    backgroundColor: '#FDCF34',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginBottom: 10,
    height: 54,
    justifyContent: 'center',
  },
  btnPublierText: { color: '#14152A', fontFamily: 'PoppinsSemiBold', fontSize: 15 },
});
