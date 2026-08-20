import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity, Image,
  StyleSheet, Alert, ActivityIndicator, SafeAreaView,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import SelecteurPuces from '../../components/store/SelecteurPuces';
import { getToutesSuggestions } from '../../services/ficheGuidee';
import { creerProduitsEnMasse } from '../../services/products';
import { pickImageFromCamera, pickImageFromGallery, uploadImage } from '../../services/storage';
import useShopStore from '../../store/shopStore';

// ─── Icône retour ─────────────────────────────────────────────────────────────

const IcoBack = () => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M19 12H5M12 19l-7-7 7-7" stroke="#EDEEF7" />
  </Svg>
);

// ─── Types ────────────────────────────────────────────────────────────────────

interface LigneProduit {
  id:          string;
  nom:         string;
  prix:        string;
  description: string;
  imageUri:    string | null;
  imageUrl:    string | null;
}

function nouvelleLigne(): LigneProduit {
  return {
    id: `l-${Date.now()}-${Math.random()}`,
    nom: '', prix: '', description: '',
    imageUri: null, imageUrl: null,
  };
}

// ─── Écran ────────────────────────────────────────────────────────────────────

interface Props {
  onClose: () => void;
}

export default function FicheGuideeScreen({ onClose }: Props) {
  const shopId        = useShopStore(s => s.shopId);
  const shopType      = useShopStore(s => s.context.shopType);
  const subcategories = useShopStore(s => s.context.subcategories);
  const categories    = useShopStore(s => s.categories);
  const loadMyShop    = useShopStore(s => s.loadMyShop);
  const sousCatId     = subcategories[0] ?? '';

  const [loading, setLoading] = useState(true);
  const [suggestions, setSuggestions] = useState<{
    typeContenu:   { id: string; valeur: string }[];
    sousCategorie: { id: string; valeur: string }[];
    nomProduit:    { id: string; valeur: string }[];
    prix:          { id: string; valeur: string }[];
  }>({ typeContenu: [], sousCategorie: [], nomProduit: [], prix: [] });

  // ── Destination unifiée (radio) ──────────────────────────────────────────────
  // Format : "cat:<id>"  |  "type:<valeur>"  |  "sous:<valeur>"  |  "libre"
  const [dest, setDest] = useState(`cat:${categories[0]?.id ?? ''}`);
  const [destLibreText, setDestLibreText] = useState('');

  // ── Lignes produit ────────────────────────────────────────────────────────────
  const [lignes, setLignes] = useState<LigneProduit[]>([nouvelleLigne()]);
  const [envoi,  setEnvoi]  = useState(false);

  useEffect(() => {
    if (!sousCatId) { setLoading(false); return; }
    getToutesSuggestions(sousCatId)
      .then(setSuggestions)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [sousCatId]);

  // Helpers pour récupérer catId / sousCategorie au moment de publier
  const getDestValues = (): { catId: string; sousCategorie: string } => {
    if (dest.startsWith('cat:'))  return { catId: dest.slice(4), sousCategorie: '' };
    if (dest.startsWith('type:')) return { catId: dest.slice(5), sousCategorie: '' };
    if (dest.startsWith('sous:')) return { catId: dest.slice(5), sousCategorie: '' };
    if (dest === 'libre') {
      const label = destLibreText.trim();
      return { catId: label || categories[0]?.id || '', sousCategorie: '' };
    }
    return { catId: categories[0]?.id ?? '', sousCategorie: '' };
  };

  const modifierLigne = (id: string, champ: keyof LigneProduit, valeur: string | null) => {
    setLignes(prev => prev.map(l => l.id === id ? { ...l, [champ]: valeur } : l));
  };

  const pickImageForLigne = async (id: string, source: 'camera' | 'gallery') => {
    const uri = source === 'camera'
      ? await pickImageFromCamera()
      : await pickImageFromGallery();
    if (uri) modifierLigne(id, 'imageUri', uri);
  };

  const ajouterLigne = () => setLignes(prev => [...prev, nouvelleLigne()]);
  const supprimerLigne = (id: string) => setLignes(prev => prev.filter(l => l.id !== id));

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

    const { catId, sousCategorie } = getDestValues();
    const itemType =
      shopType === 'services'    ? ('service'    as const) :
      shopType === 'memberships' ? ('membership' as const) :
                                   ('product'    as const);

    setEnvoi(true);
    try {
      const avecImages = await Promise.all(valides.map(async (l) => {
        if (!l.imageUri) return l;
        try {
          const url = await uploadImage('products', l.imageUri, `${shopId}/${l.id}.jpg`);
          return { ...l, imageUrl: url };
        } catch {
          return l;
        }
      }));

      await creerProduitsEnMasse(shopId, avecImages.map(l => ({
        nom:           l.nom.trim(),
        prix:          parseInt(l.prix.replace(/\D/g, ''), 10),
        description:   l.description.trim(),
        sousCategorie,
        category:      catId,
        itemType,
        imageUrl:      l.imageUrl ?? undefined,
      })));
      await loadMyShop();
      Alert.alert(
        'Fiche publiée',
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
          <Text style={s.title}>Fiche Guidée</Text>
          <Text style={s.subtitle}>Choisissez ou écrivez librement</Text>
        </View>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Section "Ajouter dans" — sélection radio unifiée ── */}
        <View style={s.destSection}>
          <Text style={s.label}>Ajouter dans</Text>
          <View style={s.puces}>

            {/* Catégories du catalogue (Formules, Produits…) */}
            {categories.map(cat => (
              <TouchableOpacity
                key={cat.id}
                style={[s.chip, dest === `cat:${cat.id}` && s.chipActive]}
                onPress={() => setDest(`cat:${cat.id}`)}
                activeOpacity={0.75}
              >
                <Text style={[s.chipTxt, dest === `cat:${cat.id}` && s.chipTxtActive]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}

            {/* Suggestions type de contenu (Tarif, Carte des abonnements…) */}
            {suggestions.typeContenu.map(sug => (
              <TouchableOpacity
                key={sug.id}
                style={[s.chip, dest === `type:${sug.valeur}` && s.chipActive]}
                onPress={() => setDest(`type:${sug.valeur}`)}
                activeOpacity={0.75}
              >
                <Text style={[s.chipTxt, dest === `type:${sug.valeur}` && s.chipTxtActive]}>
                  {sug.valeur}
                </Text>
              </TouchableOpacity>
            ))}

            {/* Suggestions sous-catégorie (Coaching, Séances…) */}
            {suggestions.sousCategorie.map(sug => (
              <TouchableOpacity
                key={sug.id}
                style={[s.chip, dest === `sous:${sug.valeur}` && s.chipActive]}
                onPress={() => setDest(`sous:${sug.valeur}`)}
                activeOpacity={0.75}
              >
                <Text style={[s.chipTxt, dest === `sous:${sug.valeur}` && s.chipTxtActive]}>
                  {sug.valeur}
                </Text>
              </TouchableOpacity>
            ))}

            {/* Autre (saisie libre) */}
            <TouchableOpacity
              style={[s.chip, dest === 'libre' && s.chipActive]}
              onPress={() => setDest('libre')}
              activeOpacity={0.75}
            >
              <Text style={[s.chipTxt, dest === 'libre' && s.chipTxtActive]}>✏️ Autre</Text>
            </TouchableOpacity>
          </View>

          {dest === 'libre' && (
            <TextInput
              style={s.inputLibre}
              value={destLibreText}
              onChangeText={setDestLibreText}
              placeholder="Ex : Menu, Catalogue, Tarifs…"
              placeholderTextColor="#6B6F9E"
              autoFocus
              returnKeyType="done"
            />
          )}
        </View>

        {/* ── Une carte par produit ── */}
        {lignes.map((ligne) => (
          <View key={ligne.id} style={s.carteProduit}>

            {/* Photo du produit */}
            <View style={{ marginBottom: 14 }}>
              <Text style={s.label}>
                Photo <Text style={s.optionnel}>(optionnel)</Text>
              </Text>
              {ligne.imageUri ? (
                <View>
                  <Image source={{ uri: ligne.imageUri }} style={s.imagePreview} resizeMode="cover" />
                  <TouchableOpacity
                    onPress={() => modifierLigne(ligne.id, 'imageUri', null)}
                    activeOpacity={0.7}
                    style={{ marginTop: 6 }}
                  >
                    <Text style={s.supprimerLigne}>Supprimer la photo</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={s.imagePickerRow}>
                  <TouchableOpacity
                    style={s.imagePickerBtn}
                    onPress={() => pickImageForLigne(ligne.id, 'camera')}
                    activeOpacity={0.8}
                  >
                    <Text style={s.imagePickerTxt}>📷 Caméra</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={s.imagePickerBtn}
                    onPress={() => pickImageForLigne(ligne.id, 'gallery')}
                    activeOpacity={0.8}
                  >
                    <Text style={s.imagePickerTxt}>🖼 Galerie</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Nom du produit */}
            <SelecteurPuces
              label="Nom du produit"
              suggestions={suggestions.nomProduit}
              valeurSelectionnee={ligne.nom}
              onSelectionner={(v) => modifierLigne(ligne.id, 'nom', v)}
              placeholderLibre="Nom de votre produit"
            />

            {/* Prix */}
            <SelecteurPuces
              label="Prix (FCFA)"
              suggestions={suggestions.prix}
              valeurSelectionnee={ligne.prix}
              onSelectionner={(v) => modifierLigne(ligne.id, 'prix', v)}
              placeholderLibre="Prix en F CFA"
              keyboardType="numeric"
            />

            {/* Description */}
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
                <Text style={s.supprimerLigne}>Retirer ce produit</Text>
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
            : <Text style={s.btnPublierText}>Publier ma fiche</Text>
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

  label:    { color: '#EDEEF7', fontFamily: 'PoppinsSemiBold', fontSize: 14, marginBottom: 10 },
  optionnel:{ color: '#6B6F9E', fontFamily: 'PoppinsRegular', fontSize: 12 },

  // Section destination unifiée
  destSection: { marginBottom: 20 },
  puces: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2A2C52',
    backgroundColor: '#1E2040',
  },
  chipActive:   { backgroundColor: 'rgba(253,207,52,.12)', borderColor: '#FDCF34' },
  chipTxt:      { color: '#9A9EC4', fontSize: 13 },
  chipTxtActive:{ color: '#FDCF34', fontFamily: 'PoppinsSemiBold' },

  inputLibre: {
    marginTop: 10,
    backgroundColor: '#1E2040',
    borderRadius: 12,
    padding: 12,
    color: '#EDEEF7',
    borderWidth: 1,
    borderColor: '#2A2C52',
  },

  // Carte produit
  carteProduit: {
    backgroundColor: '#1E2040',
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2A2C52',
  },

  // Photo produit
  imagePreview: { width: '100%', height: 180, borderRadius: 12 },
  imagePickerRow: { flexDirection: 'row', gap: 10 },
  imagePickerBtn: {
    flex: 1,
    backgroundColor: '#14152A',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A2C52',
  },
  imagePickerTxt: { color: '#9A9EC4', fontSize: 13 },

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
