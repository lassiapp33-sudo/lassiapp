import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Alert, ActivityIndicator, Switch, Modal,
  KeyboardAvoidingView, Platform, Image,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';

import LassiScreen              from '../../components/LassiScreen';
import { colors, fonts, radius, TOP_INSET } from '../../theme';
import useShopStore              from '../../store/shopStore';
import { Promotion, PromoType, PromoCibleType, getPromoStatus } from '../../types/promotions';
import { StoreProduct }          from '../../types/store';
import * as promoService         from '../../services/promotions';
import { getErrorMessage }       from '../../utils/errorUtils';
import { IcoBack, IcoPlus } from '../../components/icons';

// ─── Icônes ──────────────────────────────────────────────────────────────────

const IcoTag = ({ stroke }: { stroke: string }) => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none"
    strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" stroke={stroke} />
    <Path d="M7 7h.01" stroke={stroke} />
  </Svg>
);

const IcoEdit = () => (
  <Svg width={15} height={15} viewBox="0 0 24 24" fill="none"
    strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke={colors.muted} />
    <Path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z" stroke={colors.muted} />
  </Svg>
);

const IcoTrash = () => (
  <Svg width={15} height={15} viewBox="0 0 24 24" fill="none"
    strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2" stroke="#E07A7A" />
  </Svg>
);

// ─── Constantes ───────────────────────────────────────────────────────────────

const PROMO_TYPES: { value: PromoType; label: string; desc: string }[] = [
  { value: 'pourcentage',       label: '% Pourcentage',    desc: 'Ex : −20% sur le panier' },
  { value: 'montant_fixe',      label: 'Montant fixe',     desc: 'Ex : −500 F sur commande' },
  { value: 'quantite_offerte',  label: 'Quantité offerte', desc: 'Ex : 2 achetés = 1 offert' },
  { value: 'prix_barre',        label: 'Prix barré',       desc: 'Ex : 2000 F → 1500 F' },
];

const CIBLE_TYPES: { value: PromoCibleType; label: string }[] = [
  { value: 'vitrine',   label: 'Toute la vitrine' },
  { value: 'categorie', label: 'Une catégorie' },
  { value: 'produit',   label: 'Un produit précis' },
];

type FormState = {
  titre:      string;
  type:       PromoType;
  valeur:     string;
  cibleType:  PromoCibleType;
  cibleId:    string;
  montantMin: string;
  dateFin:    string;
  actif:      boolean;
};

const EMPTY_FORM: FormState = {
  titre:      '',
  type:       'pourcentage',
  valeur:     '',
  cibleType:  'vitrine',
  cibleId:    '',
  montantMin: '',
  dateFin:    '',
  actif:      true,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function typeValeurLabel(type: PromoType): string {
  switch (type) {
    case 'pourcentage':      return 'Valeur (%) entre 1 et 100';
    case 'montant_fixe':     return 'Montant en FCFA';
    case 'quantite_offerte': return 'X achetés (ex: 2 → 2+1 offert)';
    case 'prix_barre':       return 'Nouveau prix en FCFA';
  }
}

function validateForm(form: FormState): string | null {
  if (!form.titre.trim()) return 'Le titre est obligatoire.';
  const val = Number(form.valeur);
  if (!form.valeur || isNaN(val) || val <= 0) return 'La valeur doit être supérieure à 0.';
  if (form.type === 'pourcentage' && (val < 1 || val > 99))
    return 'Le pourcentage doit être entre 1 et 99.';
  if ((form.cibleType === 'categorie' || form.cibleType === 'produit') && !form.cibleId)
    return 'Sélectionne une catégorie ou un produit.';
  if (form.dateFin && !/^\d{2}\/\d{2}\/\d{4}$/.test(form.dateFin))
    return 'Date de fin : format JJ/MM/AAAA.';
  return null;
}

function parseDate(str: string): string | undefined {
  if (!str.trim()) return undefined;
  const [d, m, y] = str.split('/');
  return `${y}-${m}-${d}T23:59:59.000Z`;
}

function formatDateForInput(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

// Masque automatique JJ/MM/AAAA : l'utilisateur tape des chiffres, les / s'insèrent seuls
function maskDate(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

// ─── Carte promo ──────────────────────────────────────────────────────────────

function PromoCard({
  promo, products, onEdit, onDelete, onToggle,
}: {
  promo:    Promotion;
  products: StoreProduct[];
  onEdit:   () => void;
  onDelete: () => void;
  onToggle: (v: boolean) => void;
}) {
  const status = getPromoStatus(promo);
  const product = promo.cibleType === 'produit' && promo.cibleId
    ? products.find(p => p.id === promo.cibleId)
    : null;

  const cibleLabel =
    promo.cibleType === 'vitrine'   ? 'Toute la vitrine' :
    promo.cibleType === 'categorie' ? `Catégorie : ${promo.cibleId ?? '—'}` :
    product ? `Produit : ${product.name}` : '—';

  const valeurLabel =
    promo.type === 'pourcentage'      ? `−${promo.valeur}%` :
    promo.type === 'montant_fixe'     ? `−${promo.valeur.toLocaleString('fr-FR')} F` :
    promo.type === 'quantite_offerte' ? `${promo.valeur}+1 offert` :
    `→ ${promo.valeur.toLocaleString('fr-FR')} F`;

  return (
    <View style={styles.promoCard}>
      <View style={styles.promoCardTop}>
        <View style={styles.promoIconWrap}>
          <IcoTag stroke={colors.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.promoTitle} numberOfLines={1}>{promo.titre}</Text>
          <Text style={styles.promoSub}>{valeurLabel} · {cibleLabel}</Text>
        </View>
        <Switch
          value={promo.actif}
          onValueChange={onToggle}
          trackColor={{ false: colors.border, true: `${colors.accent}55` }}
          thumbColor={promo.actif ? colors.accent : '#555'}
        />
      </View>

      <View style={styles.promoCardBot}>
        <View style={[styles.statusBadge, { backgroundColor: `${status.color}22` }]}>
          <View style={[styles.statusDot, { backgroundColor: status.color }]} />
          <Text style={[styles.statusTxt, { color: status.color }]}>{status.label}</Text>
        </View>
        {promo.dateFin && (
          <Text style={styles.promoDate}>
            Jusqu'au {formatDateForInput(promo.dateFin)}
          </Text>
        )}
        {promo.montantMin > 0 && (
          <Text style={styles.promoDate}>
            Min. {promo.montantMin.toLocaleString('fr-FR')} F
          </Text>
        )}
        <View style={{ flex: 1 }} />
        <TouchableOpacity style={styles.iconBtn} onPress={onEdit} activeOpacity={0.7}>
          <IcoEdit />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn} onPress={onDelete} activeOpacity={0.7}>
          <IcoTrash />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Écran principal ──────────────────────────────────────────────────────────

interface Props { onBack: () => void; }

export default function PromotionsScreen({ onBack }: Props) {
  const shopId   = useShopStore(s => s.shopId);
  const products = useShopStore(s => s.products);

  const [promos,   setPromos]   = useState<Promotion[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editPromo,setEditPromo]= useState<Promotion | null>(null);
  const [form,     setForm]     = useState<FormState>(EMPTY_FORM);

  const loadMyShop = useShopStore(s => s.loadMyShop);

  // ── Chargement ───────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);
    try { setPromos(await promoService.getShopPromos(shopId)); }
    catch { /* silencieux */ }
    finally { setLoading(false); }
  }, [shopId]);

  useEffect(() => {
    if (!shopId && products.length === 0) { loadMyShop(); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Ouvrir le formulaire ─────────────────────────────────────────────────────
  const openCreate = () => {
    setEditPromo(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (promo: Promotion) => {
    setEditPromo(promo);
    setForm({
      titre:      promo.titre,
      type:       promo.type,
      valeur:     String(promo.valeur),
      cibleType:  promo.cibleType,
      cibleId:    promo.cibleId ?? '',
      montantMin: promo.montantMin > 0 ? String(promo.montantMin) : '',
      dateFin:    formatDateForInput(promo.dateFin),
      actif:      promo.actif,
    });
    setShowForm(true);
  };

  // ── Sauvegarder ─────────────────────────────────────────────────────────────
  const handleSave = async () => {
    const err = validateForm(form);
    if (err) { Alert.alert('Vérification', err); return; }
    if (!shopId) return;

    setSaving(true);
    try {
      const payload: Omit<Promotion, 'id' | 'shopId' | 'createdAt'> = {
        titre:      form.titre.trim(),
        type:       form.type,
        valeur:     Number(form.valeur),
        cibleType:  form.cibleType,
        cibleId:    form.cibleId || undefined,
        montantMin: Number(form.montantMin) || 0,
        dateFin:    parseDate(form.dateFin),
        actif:      form.actif,
      };

      if (editPromo) {
        await promoService.updatePromo(editPromo.id, payload);
      } else {
        await promoService.createPromo(shopId, payload);
      }
      setShowForm(false);
      await load();
    } catch (e: unknown) {
      Alert.alert('Erreur', getErrorMessage(e, 'Impossible de sauvegarder.'));
    } finally {
      setSaving(false);
    }
  };

  // ── Supprimer ────────────────────────────────────────────────────────────────
  const handleDelete = (promo: Promotion) => {
    Alert.alert('Supprimer cette promo ?', `"${promo.titre}" sera définitivement supprimée.`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive',
        onPress: async () => {
          try {
            await promoService.deletePromo(promo.id);
            setPromos(ps => ps.filter(p => p.id !== promo.id));
          } catch (e: unknown) {
            Alert.alert('Erreur', getErrorMessage(e));
          }
        },
      },
    ]);
  };

  // ── Toggle rapide ────────────────────────────────────────────────────────────
  const handleToggle = async (promo: Promotion, val: boolean) => {
    setPromos(ps => ps.map(p => p.id === promo.id ? { ...p, actif: val } : p));
    try { await promoService.togglePromo(promo.id, val); }
    catch {
      setPromos(ps => ps.map(p => p.id === promo.id ? { ...p, actif: !val } : p));
    }
  };

  // ── Setter form helper ────────────────────────────────────────────────────────
  const set = <K extends keyof FormState,>(key: K, val: FormState[K]) =>
    setForm(f => ({ ...f, [key]: val }));

  const storeCategories = useShopStore(s => s.categories);

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <LassiScreen
      header={
        <View style={[styles.head, { paddingTop: TOP_INSET + 4 }]}>
          <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.75}>
            <IcoBack />
          </TouchableOpacity>
          <Text style={styles.headTitle}>Mes promotions</Text>
          <TouchableOpacity style={styles.addBtn} onPress={openCreate} activeOpacity={0.8}>
            <IcoPlus />
            <Text style={styles.addBtnTxt}>Créer</Text>
          </TouchableOpacity>
        </View>
      }
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 18, paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
        ) : promos.length === 0 ? (
          <View style={styles.empty}>
            <IcoTag stroke={colors.muted} />
            <Text style={styles.emptyTxt}>Aucune promo pour l'instant</Text>
            <Text style={styles.emptySub}>Crée ta première promo pour attirer plus de clients !</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={openCreate} activeOpacity={0.8}>
              <Text style={styles.emptyBtnTxt}>Créer une promo</Text>
            </TouchableOpacity>
          </View>
        ) : (
          promos.map(promo => (
            <PromoCard
              key={promo.id}
              promo={promo}
              products={products}
              onEdit={() => openEdit(promo)}
              onDelete={() => handleDelete(promo)}
              onToggle={v => handleToggle(promo, v)}
            />
          ))
        )}
      </ScrollView>

      {/* ─── Modal formulaire ──────────────────────────────────────────── */}
      <Modal
        visible={showForm}
        animationType="slide"
        transparent
        onRequestClose={() => setShowForm(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>
              {editPromo ? 'Modifier la promo' : 'Nouvelle promo'}
            </Text>

            <ScrollView
              showsVerticalScrollIndicator={false}
              style={{ flex: 1 }}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
            >

              {/* Titre */}
              <Text style={styles.label}>Titre *</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex : Promo du vendredi"
                placeholderTextColor={colors.muted}
                value={form.titre}
                onChangeText={v => set('titre', v)}
              />

              {/* Type */}
              <Text style={styles.label}>Type de promo *</Text>
              <View style={styles.optionRow}>
                {PROMO_TYPES.map(pt => (
                  <TouchableOpacity
                    key={pt.value}
                    style={[styles.optionPill, form.type === pt.value && styles.optionPillOn]}
                    onPress={() => set('type', pt.value)}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.optionPillTxt, form.type === pt.value && styles.optionPillTxtOn]}>
                      {pt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Valeur */}
              <Text style={styles.label}>{typeValeurLabel(form.type)} *</Text>
              <TextInput
                style={styles.input}
                placeholder={form.type === 'pourcentage' ? '20' : '500'}
                placeholderTextColor={colors.muted}
                value={form.valeur}
                onChangeText={v => set('valeur', v)}
                keyboardType="numeric"
              />

              {/* Cible */}
              <Text style={styles.label}>Applicable sur *</Text>
              <View style={styles.optionRow}>
                {CIBLE_TYPES.map(ct => (
                  <TouchableOpacity
                    key={ct.value}
                    style={[styles.optionPill, form.cibleType === ct.value && styles.optionPillOn]}
                    onPress={() => set('cibleType', ct.value)}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.optionPillTxt, form.cibleType === ct.value && styles.optionPillTxtOn]}>
                      {ct.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Sélecteur produit si cible = produit */}
              {form.cibleType === 'produit' && (
                <>
                  <Text style={styles.label}>Produit ciblé *</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={{ marginBottom: 16 }}
                  >
                    {products.map(p => (
                      <TouchableOpacity
                        key={p.id}
                        style={[styles.prodPill, form.cibleId === p.id && styles.prodPillOn]}
                        onPress={() => set('cibleId', p.id)}
                        activeOpacity={0.8}
                      >
                        {p.photoUrl ? (
                          <Image
                            source={{ uri: p.photoUrl }}
                            style={styles.prodPillImg}
                          />
                        ) : (
                          <Text style={styles.prodPillEmoji}>{p.emoji || '📦'}</Text>
                        )}
                        <Text style={[styles.prodPillTxt, form.cibleId === p.id && styles.prodPillTxtOn]}
                          numberOfLines={1}>
                          {p.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </>
              )}

              {/* Sélecteur catégorie si cible = catégorie */}
              {form.cibleType === 'categorie' && (
                <>
                  <Text style={styles.label}>Catégorie ciblée *</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={{ marginBottom: 16 }}
                  >
                    {storeCategories.map(cat => (
                      <TouchableOpacity
                        key={cat.id}
                        style={[styles.prodPill, form.cibleId === cat.id && styles.prodPillOn]}
                        onPress={() => set('cibleId', cat.id)}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.prodPillEmoji}>{cat.emoji}</Text>
                        <Text style={[styles.prodPillTxt, form.cibleId === cat.id && styles.prodPillTxtOn]}>
                          {cat.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </>
              )}

              {/* Montant minimum */}
              <Text style={styles.label}>Montant minimum (optionnel)</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex : 3000 (promo valable dès 3000 F)"
                placeholderTextColor={colors.muted}
                value={form.montantMin}
                onChangeText={v => set('montantMin', v)}
                keyboardType="numeric"
              />

              {/* Date de fin */}
              <Text style={styles.label}>Date de fin (optionnel)</Text>
              <TextInput
                style={styles.input}
                placeholder="JJ/MM/AAAA (vide = sans limite)"
                placeholderTextColor={colors.muted}
                value={form.dateFin}
                onChangeText={v => set('dateFin', maskDate(v))}
                keyboardType="numeric"
                maxLength={10}
              />

              {/* Actif */}
              <View style={styles.activeRow}>
                <View>
                  <Text style={styles.label}>Promo active immédiatement</Text>
                  <Text style={styles.activeSub}>
                    {form.actif ? 'Visible par les clients dès maintenant' : 'Désactivée (invisible)'}
                  </Text>
                </View>
                <Switch
                  value={form.actif}
                  onValueChange={v => set('actif', v)}
                  trackColor={{ false: colors.border, true: `${colors.accent}55` }}
                  thumbColor={form.actif ? colors.accent : '#555'}
                />
              </View>

              {/* Boutons */}
              <View style={styles.formActions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setShowForm(false)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.cancelBtnTxt}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                  onPress={saving ? undefined : handleSave}
                  activeOpacity={0.85}
                >
                  {saving
                    ? <ActivityIndicator color={colors.bg} size="small" />
                    : <Text style={styles.saveBtnTxt}>
                        {editPromo ? 'Enregistrer' : 'Créer la promo'}
                      </Text>
                  }
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </LassiScreen>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Header
  head: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 18, paddingBottom: 14,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: radius.sm,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  headTitle: { color: colors.white, fontFamily: fonts.titleXL, fontSize: 20, flex: 1 },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.accent, borderRadius: radius.sm,
    paddingHorizontal: 14, paddingVertical: 9,
  },
  addBtnTxt: { color: colors.bg, fontFamily: fonts.title, fontSize: 13.5 },

  // Carte promo
  promoCard: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, marginBottom: 12, overflow: 'hidden',
  },
  promoCardTop: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
  },
  promoIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: `${colors.accent}18`,
    alignItems: 'center', justifyContent: 'center',
  },
  promoTitle: { color: colors.white, fontFamily: fonts.title, fontSize: 14 },
  promoSub:   { color: colors.muted, fontFamily: fonts.body, fontSize: 11, marginTop: 2 },
  promoCardBot: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingBottom: 12, paddingTop: 0,
  },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: 20, paddingHorizontal: 9, paddingVertical: 4,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusTxt: { fontFamily: fonts.ui, fontSize: 10.5 },
  promoDate: { color: colors.muted, fontFamily: fonts.body, fontSize: 10 },
  iconBtn: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,.05)',
    alignItems: 'center', justifyContent: 'center',
  },

  // Empty
  empty: { alignItems: 'center', marginTop: 60, gap: 8 },
  emptyTxt: { color: colors.white, fontFamily: fonts.title, fontSize: 16, marginTop: 8 },
  emptySub: { color: colors.muted, fontFamily: fonts.body, fontSize: 12, textAlign: 'center' },
  emptyBtn: {
    marginTop: 16, backgroundColor: colors.accent,
    paddingHorizontal: 24, paddingVertical: 12, borderRadius: radius.lg,
  },
  emptyBtnTxt: { color: colors.bg, fontFamily: fonts.title, fontSize: 14 },

  // Modal / Sheet
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,.6)', justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 34,
    maxHeight: '90%',
    flex: 1,
  },
  sheetHandle: {
    width: 40, height: 4, backgroundColor: colors.border,
    borderRadius: 2, alignSelf: 'center', marginBottom: 16,
  },
  sheetTitle: {
    color: colors.white, fontFamily: fonts.titleXL, fontSize: 18,
    marginBottom: 20, textAlign: 'center',
  },

  // Form
  label: {
    color: colors.muted, fontFamily: fonts.ui, fontSize: 11.5,
    marginBottom: 7, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.4,
  },
  input: {
    backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.sm, padding: 13, color: colors.white,
    fontFamily: fonts.body, fontSize: 14, marginBottom: 16,
  },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  optionPill: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  optionPillOn: { backgroundColor: `${colors.accent}22`, borderColor: colors.accent },
  optionPillTxt: { color: colors.muted, fontFamily: fonts.body, fontSize: 12 },
  optionPillTxtOn: { color: colors.accent, fontFamily: fonts.title },

  prodPill: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 8, marginRight: 8,
    flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: 150,
  },
  prodPillOn: { backgroundColor: `${colors.accent}22`, borderColor: colors.accent },
  prodPillImg: { width: 22, height: 22, borderRadius: 4 },
  prodPillEmoji: { fontSize: 15 },
  prodPillTxt: { color: colors.muted, fontFamily: fonts.body, fontSize: 12 },
  prodPillTxtOn: { color: colors.accent },

  activeRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 24, backgroundColor: colors.bg,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm,
    padding: 14,
  },
  activeSub: { color: colors.muted, fontFamily: fonts.body, fontSize: 11, marginTop: 3 },

  formActions: { flexDirection: 'row', gap: 12, marginTop: 4 },
  cancelBtn: {
    flex: 1, height: 50, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  cancelBtnTxt: { color: colors.muted, fontFamily: fonts.title, fontSize: 14 },
  saveBtn: {
    flex: 2, height: 50, borderRadius: radius.lg,
    backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  saveBtnTxt: { color: colors.bg, fontFamily: fonts.titleXL, fontSize: 15 },
});
