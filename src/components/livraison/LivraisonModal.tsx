/**
 * LivraisonModal — affiché depuis CartScreen quand le client clique "Commander + Livrer".
 * Calcule le prix à vol d'oiseau (Haversine), crée le record livraisons en DB.
 */
import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { colors, fonts, radius } from '../../theme';
import { formatPrice } from '../../utils/format';
import { devisLivraison, LIVRAISON_CONFIG } from '../../utils/haversine';
import { getCurrentLocation, reverseGeocode } from '../../services/location';
import { creerLivraison } from '../../services/livraisons';
import { supabase } from '../../lib/supabase';
import useAuthStore from '../../store/authStore';

// Dakar centre — fallback si GPS indisponible
const DAKAR_LAT = 14.6937;
const DAKAR_LNG = -17.4441;

interface Props {
  visible: boolean;
  shopId: string;
  shopName: string;
  orderId?: string;
  onClose: () => void;
  onConfirmed: (livraisonId: string) => void;
}

export default function LivraisonModal({
  visible,
  shopId,
  shopName,
  orderId,
  onClose,
  onConfirmed,
}: Props) {
  const user = useAuthStore(s => s.user);

  const [arriveeLabel, setArriveeLabel] = useState('');
  const [contactNom, setContactNom] = useState(user?.name ?? '');
  const [contactTel, setContactTel] = useState(user?.phone ?? '');

  const [coordsDepart, setCoordsDepart] = useState<{ lat: number; lng: number } | null>(null);
  const [coordsArrivee, setCoordsArrivee] = useState<{ lat: number; lng: number } | null>(null);
  const [departLabel, setDepartLabel] = useState(shopName);
  const [loadingCoords, setLoadingCoords] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const devis = coordsDepart && coordsArrivee
    ? devisLivraison(coordsDepart.lat, coordsDepart.lng, coordsArrivee.lat, coordsArrivee.lng)
    : null;
  const distanceKm = devis?.distanceKm ?? null;
  const prix = devis != null && !devis.horsZone ? devis.prix : null;

  // Récupère les coords de la boutique + position GPS du client
  useEffect(() => {
    if (!visible) return;

    setLoadingCoords(true);

    Promise.all([
      // Coords boutique
      supabase
        .from('shops')
        .select('latitude, longitude, address_text, name')
        .eq('id', shopId)
        .single()
        .then(({ data }) => {
          if (data?.latitude && data?.longitude) {
            setCoordsDepart({ lat: data.latitude, lng: data.longitude });
            setDepartLabel(data.address_text ?? data.name ?? shopName);
          } else {
            setCoordsDepart({ lat: DAKAR_LAT, lng: DAKAR_LNG });
          }
        }),
      // Coords client
      getCurrentLocation().then(async pos => {
        if (pos) {
          setCoordsArrivee({ lat: pos.latitude, lng: pos.longitude });
          const label = await reverseGeocode(pos.latitude, pos.longitude);
          setArriveeLabel(prev => prev || label);
        } else {
          setCoordsArrivee({ lat: DAKAR_LAT, lng: DAKAR_LNG });
        }
      }),
    ]).finally(() => setLoadingCoords(false));
  }, [visible, shopId, shopName]);

  const handleConfirmer = async () => {
    if (!arriveeLabel.trim()) {
      Alert.alert('Adresse requise', 'Précise l\'adresse de livraison.');
      return;
    }
    if (!coordsDepart || !coordsArrivee || devis == null) {
      Alert.alert('Erreur', 'Impossible de calculer la distance. Réessaie.');
      return;
    }
    if (devis.horsZone) {
      Alert.alert('Zone non couverte', devis.message ?? `Livraison indisponible au-delà de ${LIVRAISON_CONFIG.DISTANCE_MAX_KM} km.`);
      return;
    }
    if (prix == null) {
      Alert.alert('Erreur', 'Prix non calculable. Réessaie.');
      return;
    }
    if (!user) return;

    setSubmitting(true);
    try {
      const liv = await creerLivraison({
        demandeurId:    user.id,
        demandeurType:  'client',
        orderId,
        departLabel,
        departLat:      coordsDepart.lat,
        departLng:      coordsDepart.lng,
        arriveeLabel:   arriveeLabel.trim(),
        arriveeLat:     coordsArrivee.lat,
        arriveeLng:     coordsArrivee.lng,
        contactNom:     contactNom.trim() || undefined,
        contactTel:     contactTel.trim() || undefined,
        distanceKm:     devis.distanceKm,
        prixLivraison:  prix,
      });
      onConfirmed(liv.id);
    } catch (e: any) {
      Alert.alert('Erreur', e.message ?? 'Impossible de créer la livraison.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>Livraison à domicile</Text>

          {loadingCoords ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.accent} />
              <Text style={styles.loadingTxt}>Localisation…</Text>
            </View>
          ) : (
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Tarif */}
              {devis != null && !devis.horsZone && (
                <View style={styles.prixBanner}>
                  <Text style={styles.prixLabel}>Frais de livraison estimés</Text>
                  <Text style={styles.prixVal}>{formatPrice(devis.prix)}</Text>
                  <Text style={styles.prixSub}>{devis.distanceKm.toFixed(1)} km estimé</Text>
                </View>
              )}
              {devis?.horsZone && (
                <View style={styles.horsZoneBanner}>
                  <Text style={styles.horsZoneTxt}>{devis.message}</Text>
                </View>
              )}

              {/* Départ */}
              <Text style={styles.fieldLabel}>Départ (boutique)</Text>
              <View style={styles.fieldReadonly}>
                <Text style={styles.fieldReadonlyTxt}>{departLabel}</Text>
              </View>

              {/* Arrivée */}
              <Text style={styles.fieldLabel}>Adresse de livraison *</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex : Cité Keur Gorgui, apt 3B"
                placeholderTextColor={colors.muted}
                value={arriveeLabel}
                onChangeText={setArriveeLabel}
              />

              {/* Contact */}
              <Text style={styles.fieldLabel}>Nom du destinataire</Text>
              <TextInput
                style={styles.input}
                placeholder="Nom complet"
                placeholderTextColor={colors.muted}
                value={contactNom}
                onChangeText={setContactNom}
              />

              <Text style={styles.fieldLabel}>Téléphone du destinataire</Text>
              <TextInput
                style={styles.input}
                placeholder="77 000 00 00"
                placeholderTextColor={colors.muted}
                value={contactTel}
                onChangeText={setContactTel}
                keyboardType="phone-pad"
              />

              <Text style={styles.note}>
                Les frais de livraison sont collectés par LASSI et réglés au livreur séparément.
              </Text>
            </ScrollView>
          )}

          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.75}>
              <Text style={styles.cancelTxt}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, (submitting || loadingCoords) && styles.btnDisabled]}
              onPress={handleConfirmer}
              disabled={submitting || loadingCoords}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator color={colors.bg} size="small" />
              ) : (
                <Text style={styles.confirmTxt}>Confirmer la livraison</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 36,
    maxHeight: '90%',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    color: colors.white,
    fontFamily: fonts.titleXL,
    fontSize: 18,
    marginBottom: 16,
  },
  center: { alignItems: 'center', paddingVertical: 32, gap: 10 },
  loadingTxt: { color: colors.muted, fontFamily: fonts.label, fontSize: 13 },

  prixBanner: {
    backgroundColor: colors.accent + '18',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.accent + '44',
    padding: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  prixLabel: { color: colors.muted, fontFamily: fonts.label, fontSize: 12 },
  prixVal: { color: colors.accent, fontFamily: fonts.title, fontSize: 24, marginTop: 4 },
  prixSub: { color: colors.muted, fontFamily: fonts.label, fontSize: 11, marginTop: 2 },
  horsZoneBanner: {
    backgroundColor: colors.danger + '18',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.danger + '44',
    padding: 12,
    marginBottom: 16,
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
  note: {
    color: colors.muted,
    fontFamily: fonts.label,
    fontSize: 11,
    marginTop: 16,
    textAlign: 'center',
    lineHeight: 16,
  },
  actions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  cancelBtn: {
    flex: 1,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 13,
    alignItems: 'center',
  },
  cancelTxt: { color: colors.muted, fontFamily: fonts.ui, fontSize: 14 },
  confirmBtn: {
    flex: 2,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 13,
    alignItems: 'center',
  },
  confirmTxt: { color: colors.bg, fontFamily: fonts.ui, fontSize: 14 },
  btnDisabled: { opacity: 0.5 },
});
