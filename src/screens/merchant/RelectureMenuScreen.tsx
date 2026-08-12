import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { colors, fonts, radius } from '../../theme';
import { ProduitExtrait } from '../../utils/parsingMenu';
import { creerProduitsEnMasse } from '../../services/products';
import useShopStore from '../../store/shopStore';

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  produits: ProduitExtrait[];
  onBack: () => void;
}

// ─── Composant ───────────────────────────────────────────────────────────────

export default function RelectureMenuScreen({ produits: produitInit, onBack }: Props) {
  const shopId = useShopStore(s => s.shopId);
  const shopType = useShopStore(s => s.context.shopType);
  const categories = useShopStore(s => s.categories);
  const loadMyShop = useShopStore(s => s.loadMyShop);

  const [produits, setProduits] = useState<ProduitExtrait[]>(produitInit);
  const [envoi, setEnvoi] = useState(false);

  const SAFE_TOP = Platform.OS === 'ios' ? 56 : 20;

  const modifierNom = (id: string, nom: string) =>
    setProduits(prev => prev.map(p => (p.id === id ? { ...p, nom } : p)));

  const modifierPrix = (id: string, prixTexte: string) => {
    const prix = parseInt(prixTexte.replace(/\D/g, ''), 10) || null;
    setProduits(prev => prev.map(p => (p.id === id ? { ...p, prix } : p)));
  };

  const supprimerLigne = (id: string) =>
    setProduits(prev => prev.filter(p => p.id !== id));

  const ajouterLigneVide = () => {
    setProduits(prev => [
      ...prev,
      { id: `tmp-manuel-${Date.now()}`, nom: '', prix: null, ligneOriginale: '', confiance: 'basse' },
    ]);
  };

  const valides = produits.filter(p => p.nom.trim().length > 0 && p.prix && p.prix > 0);
  const invalides = produits.length - valides.length;

  const envoyer = async (liste: ProduitExtrait[]) => {
    if (!shopId) { Alert.alert('Erreur', 'Boutique non chargée. Réessaie.'); return; }

    const itemType =
      shopType === 'services' ? 'service' : shopType === 'memberships' ? 'membership' : 'product';
    const defaultCat = categories[0]?.id ?? '';

    setEnvoi(true);
    try {
      const r = await creerProduitsEnMasse(
        shopId,
        liste.map(p => ({
          nom: p.nom.trim(),
          prix: p.prix!,
          description: '',
          sousCategorie: '',
          category: defaultCat,
          itemType,
        })),
      );
      await loadMyShop();
      Alert.alert(
        '✅ Menu publié',
        `${r.count} produit(s) ajouté(s) à votre vitrine.\nVous pouvez compléter les détails (photo, catégorie) depuis la boutique.`,
        [{ text: 'OK', onPress: onBack }],
      );
    } catch {
      Alert.alert('Erreur', 'Impossible d\'enregistrer les produits. Réessayez.');
    } finally {
      setEnvoi(false);
    }
  };

  const confirmer = () => {
    if (valides.length === 0) {
      Alert.alert('Rien à publier', 'Vérifiez que chaque produit a un nom et un prix valide.');
      return;
    }
    if (invalides > 0) {
      Alert.alert(
        'Produits incomplets',
        `${invalides} ligne(s) sans nom ou prix valide seront ignorées. Continuer ?`,
        [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Continuer', onPress: () => envoyer(valides) },
        ],
      );
      return;
    }
    envoyer(valides);
  };

  return (
    <View style={[s.container, { paddingTop: SAFE_TOP }]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} style={s.backBtn} activeOpacity={0.7}>
          <Text style={s.backTxt}>← Retour</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Vérifiez votre menu</Text>
      </View>

      <Text style={s.subtitle}>
        {produits.length} produit(s) détecté(s). Corrigez ce qui est nécessaire
        avant de publier — rien n'est mis en ligne sans votre validation.
      </Text>

      <FlatList
        data={produits}
        keyExtractor={item => item.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={s.list}
        renderItem={({ item }) => (
          <View style={[s.card, item.confiance === 'basse' && s.cardAlerte]}>
            {item.confiance === 'basse' && (
              <Text style={s.badgeAlerte}>⚠️ À vérifier</Text>
            )}
            <TextInput
              style={s.inputNom}
              value={item.nom}
              onChangeText={v => modifierNom(item.id, v)}
              placeholder="Nom du produit"
              placeholderTextColor={colors.muted}
            />
            <View style={s.rowPrix}>
              <TextInput
                style={s.inputPrix}
                value={item.prix?.toString() ?? ''}
                onChangeText={v => modifierPrix(item.id, v)}
                placeholder="Prix"
                placeholderTextColor={colors.muted}
                keyboardType="numeric"
              />
              <Text style={s.fcfa}>F CFA</Text>
              <TouchableOpacity onPress={() => supprimerLigne(item.id)} hitSlop={8}>
                <Text style={s.supprimer}>🗑️</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListFooterComponent={
          <TouchableOpacity style={s.btnAjouter} onPress={ajouterLigneVide} activeOpacity={0.8}>
            <Text style={s.btnAjouterText}>+ Ajouter un produit manquant</Text>
          </TouchableOpacity>
        }
      />

      <TouchableOpacity
        style={[s.btnConfirmer, (envoi || valides.length === 0) && s.btnDisabled]}
        onPress={confirmer}
        disabled={envoi || valides.length === 0}
        activeOpacity={0.85}
      >
        {envoi ? (
          <ActivityIndicator color={colors.bg} size="small" />
        ) : (
          <Text style={s.btnConfirmerText}>
            Publier {valides.length} produit{valides.length > 1 ? 's' : ''}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: 16,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  backBtn: { paddingVertical: 4 },
  backTxt: { color: colors.accent, fontFamily: fonts.body, fontSize: 14 },
  headerTitle: { color: colors.white, fontFamily: fonts.title, fontSize: 18 },

  subtitle: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
    marginBottom: 14,
    lineHeight: 18,
  },

  list: { paddingBottom: 12, gap: 10 },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardAlerte: { borderColor: '#E07A7A' },
  badgeAlerte: { color: '#E07A7A', fontFamily: fonts.body, fontSize: 11, marginBottom: 6 },

  inputNom: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 15,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 6,
    marginBottom: 10,
  },

  rowPrix: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  inputPrix: {
    flex: 1,
    color: colors.accent,
    fontFamily: fonts.body,
    fontSize: 15,
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  fcfa: { color: colors.muted, fontFamily: fonts.body, fontSize: 12 },
  supprimer: { fontSize: 18, paddingHorizontal: 6 },

  btnAjouter: {
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderStyle: 'dashed',
    marginTop: 6,
  },
  btnAjouterText: { color: colors.muted, fontFamily: fonts.body, fontSize: 13 },

  btnConfirmer: {
    backgroundColor: colors.accent,
    borderRadius: radius.lg,
    padding: 16,
    alignItems: 'center',
    marginVertical: 16,
  },
  btnDisabled: { opacity: 0.4 },
  btnConfirmerText: { color: colors.bg, fontFamily: fonts.title, fontSize: 15 },
});
