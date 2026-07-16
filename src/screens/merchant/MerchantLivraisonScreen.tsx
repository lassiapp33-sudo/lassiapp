/**
 * MerchantLivraisonScreen — Prestataire envoie un colis via un livreur.
 * Calcul à vol d'oiseau (Haversine), même grille tarifaire que le client.
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { colors, fonts, radius, TOP_INSET } from '../../theme';
import LassiScreen from '../../components/LassiScreen';
import { IcoBack } from '../../components/icons';
import { formatPrice } from '../../utils/format';
import { devisLivraison, LIVRAISON_CONFIG } from '../../utils/haversine';
import { getCurrentLocation, reverseGeocode } from '../../services/location';
import { creerLivraison } from '../../services/livraisons';
import { supabase } from '../../lib/supabase';
import useAuthStore from '../../store/authStore';
import useShopStore from '../../store/shopStore';

// Dakar centre — fallback
const DAKAR_LAT = 14.6937;
const DAKAR_LNG = -17.4441;

interface Props {
  onBack: () => void;
}

export default function MerchantLivraisonScreen({ onBack }: Props) {
  const user = useAuthStore(s => s.user);
  const shopId = useShopStore(s => s.shopId);
  const shopName = useShopStore(s => s.profile.name);

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
  const distanceKm = devis?.distanceKm ?? null;
  const prix = devis != null && !devis.horsZone ? devis.prix : null;

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
    if (prix == null) {
      Alert.alert('Erreur', 'Prix non calculable. Réessaie.');
      return;
    }
    if (!user) return;

    setSubmitting(true);
    try {
      await creerLivraison({
        demandeurId:    user.id,
        demandeurType:  'prestataire',
        departLabel,
        departLat:      coordsDepart.lat,
        departLng:      coordsDepart.lng,
        arriveeLabel:   arriveeLabel.trim(),
        arriveeLat:     coordsArrivee.lat,
        arriveeLng:     coordsArrivee.lng,
        contactNom:     contactNom.trim() || undefined,
        contactTel:     contactTel.trim(),
        distanceKm:     devis.distanceKm,
        prixLivraison:  prix,
      });
      Alert.alert(
        'Livraison demandée',
        `Un livreur va prendre en charge votre colis.\nFrais : ${formatPrice(prix)}`,
        [{ text: 'OK', onPress: onBack }],
      );
    } catch (e: any) {
      Alert.alert('Erreur', e.message ?? 'Impossible de créer la livraison.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <LassiScreen
      header={
        <View style={[styles.head, { paddingTop: TOP_INSET + 4 }]}>
          <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.75}>
            <IcoBack />
          </TouchableOpacity>
          <Text style={styles.headTitle}>Envoyer un colis</Text>
        </View>
      }
    >
      <KeyboardAvoidingView
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
