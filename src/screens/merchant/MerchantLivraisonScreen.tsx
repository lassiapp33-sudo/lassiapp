/**
 * MerchantLivraisonScreen — Prestataire envoie un colis via un livreur.
 * Calcul à vol d'oiseau (Haversine), même grille tarifaire que le client.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  FlatList,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
} from 'react-native';
import { colors, fonts, radius, TOP_INSET } from '../../theme';
import LassiScreen from '../../components/LassiScreen';
import { IcoBack } from '../../components/icons';
import { formatPrice } from '../../utils/format';
import { devisLivraison, LIVRAISON_CONFIG } from '../../utils/haversine';
import { getCurrentLocation, reverseGeocode } from '../../services/location';
import { creerLivraison, getLivraisonsDemandeur, Livraison } from '../../services/livraisons';
import { supabase } from '../../lib/supabase';
import useShopStore from '../../store/shopStore';

// Dakar centre — fallback
const DAKAR_LAT = 14.6937;
const DAKAR_LNG = -17.4441;

interface Props {
  onBack: () => void;
}

const STATUT_CONFIG: Record<Livraison['statut'], { label: string; color: string }> = {
  en_attente: { label: 'En attente',  color: '#FDCF34' },
  acceptee:   { label: 'En cours',    color: '#5B9EF7' },
  terminee:   { label: 'Livrée',      color: colors.success },
  annulee:    { label: 'Annulée',     color: colors.danger },
};

export default function MerchantLivraisonScreen({ onBack }: Props) {
  const shopId = useShopStore(s => s.shopId);
  const shopName = useShopStore(s => s.profile.name);

  const [onglet, setOnglet] = useState<'new' | 'history'>('new');
  const [historique, setHistorique] = useState<Livraison[]>([]);
  const [histLoading, setHistLoading] = useState(false);
  const [histRefreshing, setHistRefreshing] = useState(false);

  const chargerHistorique = useCallback(async () => {
    const data = await getLivraisonsDemandeur();
    setHistorique(data);
    setHistLoading(false);
    setHistRefreshing(false);
  }, []);

  useEffect(() => {
    if (onglet === 'history' && historique.length === 0) {
      setHistLoading(true);
      chargerHistorique();
    }
  }, [onglet, historique.length, chargerHistorique]);

  const [arriveeLabel, setArriveeLabel] = useState('');
  const [contactNom, setContactNom] = useState('');
  const [contactTel, setContactTel] = useState('');
  const [description, setDescription] = useState('');

  const [departLabel, setDepartLabel] = useState(shopName);
  const [coordsDepart, setCoordsDepart] = useState<{ lat: number; lng: number }>({
    lat: DAKAR_LAT,
    lng: DAKAR_LNG,
  });
  const [coordsArrivee, setCoordsArrivee] = useState<{ lat: number; lng: number } | null>(null);
  const [loadingCoords, setLoadingCoords] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const devis =
    coordsArrivee != null
      ? devisLivraison(coordsDepart.lat, coordsDepart.lng, coordsArrivee.lat, coordsArrivee.lng)
      : null;

  useEffect(() => {
    const fetchAll = async () => {
      setLoadingCoords(true);
      await Promise.all([
        // Coords boutique
        shopId
          ? supabase
              .from('shops')
              .select('latitude, longitude, address_text')
              .eq('id', shopId)
              .single()
              .then(({ data }) => {
                if (data?.latitude && data?.longitude) {
                  setCoordsDepart({ lat: data.latitude, lng: data.longitude });
                  setDepartLabel(data.address_text ?? shopName);
                }
              })
          : Promise.resolve(),
        // Coords GPS du prestataire pour pré-remplir si disponible
        getCurrentLocation().then(async pos => {
          if (pos) {
            setCoordsArrivee({ lat: pos.latitude, lng: pos.longitude });
            const label = await reverseGeocode(pos.latitude, pos.longitude);
            setArriveeLabel(prev => prev || label);
          }
        }),
      ]);
      setLoadingCoords(false);
    };
    fetchAll();
  }, [shopId, shopName]);

  const handleDemander = async () => {
    if (!arriveeLabel.trim()) {
      Alert.alert('Adresse requise', 'Précise l\'adresse de destination.');
      return;
    }
    if (!contactTel.trim()) {
      Alert.alert('Téléphone requis', 'Ajoute le numéro du destinataire.');
      return;
    }
    if (coordsArrivee == null || devis == null) {
      Alert.alert('Erreur', 'Position du destinataire non disponible. Active le GPS.');
      return;
    }
    if (devis.horsZone) {
      Alert.alert(
        'Zone non couverte',
        devis.message ?? `Livraison indisponible au-delà de ${LIVRAISON_CONFIG.DISTANCE_MAX_KM} km.`,
      );
      return;
    }
    setSubmitting(true);
    const result = await creerLivraison({
      demandeurType: 'prestataire',
      departLabel,
      departLat:    coordsDepart.lat,
      departLng:    coordsDepart.lng,
      arriveeLabel: arriveeLabel.trim(),
      arriveeLat:   coordsArrivee.lat,
      arriveeLng:   coordsArrivee.lng,
      contactNom:   contactNom.trim() || undefined,
      contactTel:   contactTel.trim(),
    });
    setSubmitting(false);

    if (!result.success) {
      Alert.alert('Erreur', result.error);
      return;
    }
    Alert.alert(
      'Livraison demandée',
      `Un livreur va prendre en charge votre colis.\nFrais : ${formatPrice(result.prix)}`,
      [{ text: 'OK', onPress: onBack }],
    );
  };

  return (
    <LassiScreen
      header={
        <View style={[styles.head, { paddingTop: TOP_INSET + 4 }]}>
          <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.75}>
            <IcoBack />
          </TouchableOpacity>
          <Text style={styles.headTitle}>Livraison</Text>
          <View style={styles.tabs}>
            <TouchableOpacity
              style={[styles.tab, onglet === 'new' && styles.tabActive]}
              onPress={() => setOnglet('new')}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabTxt, onglet === 'new' && styles.tabTxtActive]}>Nouveau</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, onglet === 'history' && styles.tabActive]}
              onPress={() => setOnglet('history')}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabTxt, onglet === 'history' && styles.tabTxtActive]}>Historique</Text>
            </TouchableOpacity>
          </View>
        </View>
      }
    >
      {onglet === 'history' && (
        histLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.accent} size="large" />
          </View>
        ) : (
          <FlatList
            data={historique}
            keyExtractor={item => item.id}
            contentContainerStyle={{ padding: 16, gap: 12 }}
            refreshControl={
              <RefreshControl
                refreshing={histRefreshing}
                onRefresh={() => { setHistRefreshing(true); chargerHistorique(); }}
                tintColor={colors.accent}
              />
            }
            ListEmptyComponent={
              <View style={styles.center}>
                <Text style={styles.emptyTxt}>Aucune livraison pour l'instant.</Text>
              </View>
            }
            renderItem={({ item }) => {
              const cfg = STATUT_CONFIG[item.statut];
              return (
                <View style={styles.histCard}>
                  <View style={styles.histTop}>
                    <View style={[styles.histBadge, { backgroundColor: cfg.color + '22' }]}>
                      <Text style={[styles.histBadgeTxt, { color: cfg.color }]}>{cfg.label}</Text>
                    </View>
                    <Text style={styles.histPrix}>{formatPrice(item.prix_livraison)}</Text>
                  </View>
                  <Text style={styles.histLabel}>Vers : <Text style={styles.histVal}>{item.arrivee_label}</Text></Text>
                  {item.contact_nom ? (
                    <Text style={styles.histMeta}>{item.contact_nom}{item.contact_tel ? ` · ${item.contact_tel}` : ''}</Text>
                  ) : null}
                  <Text style={styles.histMeta}>
                    {Number(item.distance_km).toFixed(1)} km
                    {item.created_at ? ` · ${new Date(item.created_at).toLocaleDateString('fr-SN', { day: 'numeric', month: 'short' })}` : ''}
                  </Text>
                </View>
              );
            }}
          />
        )
      )}

      {onglet === 'new' && (<><KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Tarif estimé */}
          {devis != null && !devis.horsZone && (
            <View style={styles.prixBanner}>
              <Text style={styles.prixLabel}>Frais de livraison estimés</Text>
              <Text style={styles.prixVal}>{formatPrice(devis.prix)}</Text>
              <Text style={styles.prixSub}>{devis.distanceKm.toFixed(1)} km estimé</Text>
            </View>
          )}
          {devis?.horsZone && (
            <View style={[styles.prixBanner, styles.horsZoneBanner]}>
              <Text style={styles.horsZoneTxt}>{devis.message}</Text>
            </View>
          )}

          {/* Départ */}
          <Text style={styles.fieldLabel}>Départ (votre boutique)</Text>
          <View style={styles.fieldReadonly}>
            <Text style={styles.fieldReadonlyTxt}>{departLabel}</Text>
          </View>

          {/* Arrivée */}
          <Text style={styles.fieldLabel}>Adresse de livraison *</Text>
          {loadingCoords ? (
            <ActivityIndicator color={colors.accent} style={{ marginVertical: 12 }} />
          ) : (
            <TextInput
              style={styles.input}
              placeholder="Ex : Sacré-Cœur 3, villa 12"
              placeholderTextColor={colors.muted}
              value={arriveeLabel}
              onChangeText={setArriveeLabel}
            />
          )}

          {/* Description colis */}
          <Text style={styles.fieldLabel}>Description du colis (optionnel)</Text>
          <TextInput
            style={[styles.input, styles.inputMulti]}
            placeholder="Ex : commande confirmée, fragile"
            placeholderTextColor={colors.muted}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={2}
          />

          {/* Contact destinataire */}
          <Text style={styles.fieldLabel}>Nom du destinataire</Text>
          <TextInput
            style={styles.input}
            placeholder="Nom complet"
            placeholderTextColor={colors.muted}
            value={contactNom}
            onChangeText={setContactNom}
          />

          <Text style={styles.fieldLabel}>Téléphone du destinataire *</Text>
          <TextInput
            style={styles.input}
            placeholder="77 000 00 00"
            placeholderTextColor={colors.muted}
            value={contactTel}
            onChangeText={setContactTel}
            keyboardType="phone-pad"
          />

          <Text style={styles.note}>
            Les frais de livraison sont collectés par LASSI et reversés au livreur.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.btn, submitting && styles.btnDisabled]}
            onPress={handleDemander}
            disabled={submitting}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color={colors.bg} size="small" />
            ) : (
              <Text style={styles.btnTxt}>Demander un livreur</Text>
            )}
          </TouchableOpacity>
        </View>
      </>)}
    </LassiScreen>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingBottom: 14,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headTitle: { color: colors.white, fontFamily: fonts.titleXL, fontSize: 20, flex: 1 },

  prixBanner: {
    backgroundColor: colors.accent + '18',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.accent + '44',
    padding: 14,
    alignItems: 'center',
    marginBottom: 20,
  },
  prixLabel: { color: colors.muted, fontFamily: fonts.label, fontSize: 12 },
  prixVal: { color: colors.accent, fontFamily: fonts.title, fontSize: 24, marginTop: 4 },
  prixSub: { color: colors.muted, fontFamily: fonts.label, fontSize: 11, marginTop: 2 },
  horsZoneBanner: {
    backgroundColor: colors.danger + '18',
    borderColor: colors.danger + '44',
  },
  horsZoneTxt: { color: colors.danger, fontFamily: fonts.label, fontSize: 12, textAlign: 'center' },

  fieldLabel: {
    color: colors.muted,
    fontFamily: fonts.label,
    fontSize: 12,
    marginBottom: 6,
    marginTop: 14,
  },
  fieldReadonly: {
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  fieldReadonlyTxt: { color: colors.muted, fontFamily: fonts.body, fontSize: 14 },
  input: {
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.white,
    fontFamily: fonts.body,
    fontSize: 14,
  },
  inputMulti: { minHeight: 60, textAlignVertical: 'top' },
  note: {
    color: colors.muted,
    fontFamily: fonts.label,
    fontSize: 11,
    marginTop: 20,
    textAlign: 'center',
    lineHeight: 16,
  },

  tabs: { flexDirection: 'row', gap: 8, marginTop: 10 },
  tab: {
    flex: 1, paddingVertical: 7, borderRadius: radius.md,
    backgroundColor: colors.bg, alignItems: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  tabActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  tabTxt: { color: colors.muted, fontFamily: fonts.label, fontSize: 12 },
  tabTxtActive: { color: colors.bg },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyTxt: { color: colors.muted, fontFamily: fonts.body, fontSize: 14, textAlign: 'center' },

  histCard: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, padding: 14, gap: 4,
  },
  histTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  histBadge: { borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  histBadgeTxt: { fontFamily: fonts.label, fontSize: 10 },
  histPrix: { color: colors.accent, fontFamily: fonts.title, fontSize: 15 },
  histLabel: { color: colors.muted, fontFamily: fonts.label, fontSize: 11 },
  histVal: { color: colors.white, fontFamily: fonts.body },
  histMeta: { color: colors.muted, fontFamily: fonts.label, fontSize: 11, marginTop: 2 },

  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 14,
    paddingBottom: 20,
    backgroundColor: 'rgba(20,21,42,.97)',
  },
  btn: {
    height: 55,
    borderRadius: radius.lg,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.5 },
  btnTxt: { color: colors.bg, fontFamily: fonts.titleXL, fontSize: 16 },
});
