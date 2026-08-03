import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, FlatList, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform, RefreshControl, Linking,
} from 'react-native';
import { colors, fonts, radius, TOP_INSET } from '../../theme';
import LassiScreen from '../../components/LassiScreen';
import { IcoBack } from '../../components/icons';
import { IcoTruck } from '../../components/common/LassiIcons';
import { formatPrice } from '../../utils/format';
import { devisLivraison, LIVRAISON_CONFIG } from '../../config/livraison';
import { getCurrentLocation, reverseGeocode } from '../../services/location';
import { getLivraisonsDemandeur, Livraison } from '../../services/livraisons';
import { initierPaiementLivraison, verifierPaiementLivraison } from '../../services/livraisonsPayment';
import { supabase } from '../../lib/supabase';
import useShopStore from '../../store/shopStore';
import PayMethodCard from '../../components/payment/PayMethodCard';
import { PayMethod } from '../../types/payment';
import AddressAutocomplete from '../../components/livraison/AddressAutocomplete';
import { DakarAddress } from '../../data/dakarAddresses';

const DAKAR_LAT = 14.6937;
const DAKAR_LNG = -17.4441;

type Stage = 'form' | 'waiting' | 'success';
type Onglet = 'new' | 'encours' | 'history';

const STATUT_CONFIG: Record<Livraison['statut'], { label: string; color: string }> = {
  en_attente: { label: 'En attente',  color: colors.accent },
  acceptee:   { label: 'En cours',    color: '#5B9EF7' },
  terminee:   { label: 'Livrée',      color: colors.success },
  annulee:    { label: 'Annulée',     color: colors.danger },
};

interface Props {
  onBack: () => void;
}

export default function MerchantLivraisonScreen({ onBack }: Props) {
  const shopId   = useShopStore(s => s.shopId);
  const shopName = useShopStore(s => s.profile.name);

  const [onglet, setOnglet] = useState<Onglet>('new');
  const [stage,  setStage]  = useState<Stage>('form');

  // ── Formulaire ─────────────────────────────────────────────────────────────
  const [departLabel,  setDepartLabel]  = useState('');
  const [coordsDepart, setCoordsDepart] = useState<{ lat: number; lng: number }>({ lat: DAKAR_LAT, lng: DAKAR_LNG });

  const [arriveeLabel,  setArriveeLabel]  = useState('');
  const [coordsArrivee, setCoordsArrivee] = useState<{ lat: number; lng: number } | null>(null);

  const [contactNom, setContactNom] = useState('');
  const [contactTel, setContactTel] = useState('');
  const [method,     setMethod]     = useState<PayMethod>('wave');
  const [loadingCoords, setLoadingCoords] = useState(true);

  // ── Paiement ───────────────────────────────────────────────────────────────
  const piIdRef = useRef('');
  const montantRef = useRef(0);
  const livraisonIdRef = useRef('');
  const [paying,    setPaying]    = useState(false);
  const [verifying, setVerifying] = useState(false);

  // ── Historique ─────────────────────────────────────────────────────────────
  const [livraisons,   setLivraisons]   = useState<Livraison[]>([]);
  const [histLoading,  setHistLoading]  = useState(false);
  const [histRefresh,  setHistRefresh]  = useState(false);

  const devis = coordsArrivee
    ? devisLivraison(coordsDepart.lat, coordsDepart.lng, coordsArrivee.lat, coordsArrivee.lng)
    : null;

  // ── Chargement initial des coordonnées ─────────────────────────────────────
  useEffect(() => {
    setLoadingCoords(true);
    Promise.all([
      shopId
        ? supabase.from('shops').select('latitude, longitude, address_text').eq('id', shopId).single()
            .then(({ data }) => {
              if (data?.latitude && data?.longitude) {
                setCoordsDepart({ lat: data.latitude, lng: data.longitude });
                setDepartLabel(data.address_text ?? shopName);
              } else {
                setDepartLabel(shopName);
              }
            })
        : Promise.resolve(setDepartLabel(shopName)),
      getCurrentLocation().then(async pos => {
        if (pos) {
          setCoordsArrivee({ lat: pos.latitude, lng: pos.longitude });
          const label = await reverseGeocode(pos.latitude, pos.longitude);
          setArriveeLabel(prev => prev || label);
        }
      }),
    ]).finally(() => setLoadingCoords(false));
  }, [shopId, shopName]);

  // ── Chargement historique ──────────────────────────────────────────────────
  const chargerHistorique = useCallback(async () => {
    const data = await getLivraisonsDemandeur();
    setLivraisons(data);
    setHistLoading(false);
    setHistRefresh(false);
  }, []);

  useEffect(() => {
    if ((onglet === 'encours' || onglet === 'history') && livraisons.length === 0) {
      setHistLoading(true);
      chargerHistorique();
    }
  }, [onglet, livraisons.length, chargerHistorique]);

  // ── Payer ──────────────────────────────────────────────────────────────────
  const handlePayer = async () => {
    if (!arriveeLabel.trim()) {
      Alert.alert('Adresse requise', 'Précise l\'adresse de destination.'); return;
    }
    if (!contactTel.trim()) {
      Alert.alert('Téléphone requis', 'Ajoute le numéro du destinataire.'); return;
    }
    if (!coordsArrivee || !devis) {
      Alert.alert('Position indisponible', 'Active le GPS et réessaie.'); return;
    }
    if (devis.horsZone) {
      Alert.alert('Hors zone', `Livraison impossible au-delà de ${LIVRAISON_CONFIG.DISTANCE_MAX_KM} km.`); return;
    }

    setPaying(true);
    try {
      const session = await initierPaiementLivraison({
        departLabel,
        departLat:  coordsDepart.lat,
        departLng:  coordsDepart.lng,
        arriveeLabel: arriveeLabel.trim(),
        arriveeLat:  coordsArrivee.lat,
        arriveeLng:  coordsArrivee.lng,
        contactNom:  contactNom.trim() || undefined,
        contactTel:  contactTel.trim(),
        method,
      });

      piIdRef.current     = session.piId;
      montantRef.current  = session.montant;

      if (session.simulation) {
        // Mode démo : paiement auto-confirmé
        const v = await verifierPaiementLivraison(session.piId);
        if (v.paid && v.livraisonId) {
          livraisonIdRef.current = v.livraisonId;
          setLivraisons([]);
          setStage('success');
        }
        return;
      }

      if (session.paymentUrl) await Linking.openURL(session.paymentUrl);
      setStage('waiting');
    } catch (e: unknown) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Impossible d\'initier le paiement.');
    } finally {
      setPaying(false);
    }
  };

  const handleVerifier = async () => {
    if (!piIdRef.current || verifying) return;
    setVerifying(true);
    try {
      const v = await verifierPaiementLivraison(piIdRef.current);
      if (v.paid && v.livraisonId) {
        livraisonIdRef.current = v.livraisonId;
        setLivraisons([]);
        setStage('success');
      } else {
        Alert.alert('Paiement non confirmé', 'Le paiement n\'est pas encore reçu. Attends quelques secondes et réessaie.');
      }
    } catch (e: unknown) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Impossible de vérifier le paiement.');
    } finally {
      setVerifying(false);
    }
  };

  const handleNouvelleCommande = () => {
    setStage('form');
    setArriveeLabel('');
    setContactNom('');
    setContactTel('');
    setCoordsArrivee(null);
    piIdRef.current = '';
    setOnglet('encours');
    setLivraisons([]);
    setHistLoading(true);
    chargerHistorique();
  };

  // ── Render : liste livraisons ───────────────────────────────────────────────
  const livraisonsEnCours = useMemo(
    () => livraisons.filter(l => l.statut === 'en_attente' || l.statut === 'acceptee'),
    [livraisons],
  );
  const livraisonsHistorique = useMemo(
    () => livraisons.filter(l => l.statut === 'terminee' || l.statut === 'annulee'),
    [livraisons],
  );
  const listeAffichee = useMemo(
    () => onglet === 'encours' ? livraisonsEnCours : livraisonsHistorique,
    [onglet, livraisonsEnCours, livraisonsHistorique],
  );

  const renderCard = useCallback(({ item }: { item: Livraison }) => {
    const cfg = STATUT_CONFIG[item.statut];
    return (
      <View style={s.card}>
        <View style={s.cardTop}>
          <View style={[s.badge, { backgroundColor: cfg.color + '22' }]}>
            <Text style={[s.badgeTxt, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
          <Text style={s.cardPrix}>{formatPrice(item.prix_livraison)}</Text>
        </View>
        <Text style={s.fl}>Vers : <Text style={s.fv}>{item.arrivee_label}</Text></Text>
        {item.contact_nom ? <Text style={s.fm}>{item.contact_nom}{item.contact_tel ? ` · ${item.contact_tel}` : ''}</Text> : null}
        <Text style={s.fm}>{Number(item.distance_km).toFixed(1)} km · {new Date(item.created_at).toLocaleDateString('fr-SN', { day: 'numeric', month: 'short' })}</Text>
      </View>
    );
  }, []);

  // ── Écran succès ───────────────────────────────────────────────────────────
  if (stage === 'success') {
    return (
      <LassiScreen header={<Header onBack={onBack} />}>
        <View style={s.center}>
          <IcoTruck size={64} />
          <Text style={s.successTitle}>Livraison demandée</Text>
          <Text style={s.successSub}>
            Un livreur va prendre en charge votre colis.{'\n'}
            Frais payés : {formatPrice(montantRef.current)}
          </Text>
          <TouchableOpacity style={s.newBtn} onPress={handleNouvelleCommande} activeOpacity={0.85}>
            <Text style={s.newBtnTxt}>Voir mes livraisons</Text>
          </TouchableOpacity>
        </View>
      </LassiScreen>
    );
  }

  // ── Écran attente paiement ─────────────────────────────────────────────────
  if (stage === 'waiting') {
    return (
      <LassiScreen header={<Header onBack={() => setStage('form')} title="Paiement en cours" />}>
        <View style={s.center}>
          <ActivityIndicator color={colors.accent} size="large" style={{ marginBottom: 20 }} />
          <Text style={s.waitTitle}>Paiement {method === 'wave' ? 'Wave' : 'Orange Money'}</Text>
          <Text style={s.waitSub}>Complète le paiement de {formatPrice(montantRef.current)} dans l'app de paiement, puis reviens ici.</Text>
          <TouchableOpacity style={s.verifyBtn} onPress={handleVerifier} disabled={verifying} activeOpacity={0.85}>
            {verifying
              ? <ActivityIndicator color={colors.bg} size="small" />
              : <Text style={s.verifyBtnTxt}>J'ai payé — vérifier</Text>
            }
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setStage('form')} style={{ marginTop: 14 }} activeOpacity={0.7}>
            <Text style={s.cancelTxt}>Annuler</Text>
          </TouchableOpacity>
        </View>
      </LassiScreen>
    );
  }

  // ── Écran principal ────────────────────────────────────────────────────────
  return (
    <LassiScreen header={
      <View style={{ paddingTop: TOP_INSET + 4, paddingHorizontal: 18, paddingBottom: 12 }}>
        <View style={s.headRow}>
          <TouchableOpacity style={s.backBtn} onPress={onBack} activeOpacity={0.75}>
            <IcoBack />
          </TouchableOpacity>
          <Text style={s.headTitle}>Livraison</Text>
        </View>
        <View style={s.tabs}>
          {(['new', 'encours', 'history'] as Onglet[]).map(o => (
            <TouchableOpacity
              key={o}
              style={[s.tab, onglet === o && s.tabActive]}
              onPress={() => setOnglet(o)}
              activeOpacity={0.8}
            >
              <Text style={[s.tabTxt, onglet === o && s.tabTxtActive]}>
                {o === 'new' ? 'Nouveau' : o === 'encours' ? 'En cours' : 'Historique'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    }>

      {/* ─── Onglets en cours + historique ──────────────────────────────────── */}
      {(onglet === 'encours' || onglet === 'history') && (
        histLoading ? (
          <View style={s.center}><ActivityIndicator color={colors.accent} size="large" /></View>
        ) : (
          <FlatList
            data={listeAffichee}
            keyExtractor={item => item.id}
            contentContainerStyle={{ padding: 16, gap: 12 }}
            removeClippedSubviews
            maxToRenderPerBatch={6}
            windowSize={5}
            initialNumToRender={8}
            refreshControl={
              <RefreshControl
                refreshing={histRefresh}
                onRefresh={() => { setHistRefresh(true); chargerHistorique(); }}
                tintColor={colors.accent}
              />
            }
            ListEmptyComponent={
              <View style={s.center}>
                <Text style={s.emptyTxt}>
                  {onglet === 'encours' ? 'Aucune livraison en cours.' : 'Aucun historique.'}
                </Text>
              </View>
            }
            renderItem={renderCard}
          />
        )
      )}

      {/* ─── Onglet nouveau ─────────────────────────────────────────────────── */}
      {onglet === 'new' && (
        <>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            <ScrollView
              contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Devis */}
              {devis && !devis.horsZone && (
                <View style={s.devisBanner}>
                  <Text style={s.devisLabel}>Frais de livraison</Text>
                  <Text style={s.devisPrix}>{formatPrice(devis.prix)}</Text>
                  <Text style={s.devisKm}>{devis.distanceKm.toFixed(1)} km estimé</Text>
                </View>
              )}
              {devis?.horsZone && (
                <View style={[s.devisBanner, s.horsZone]}>
                  <Text style={s.horsZoneTxt}>{devis.message}</Text>
                </View>
              )}

              {/* Départ */}
              <Text style={s.fl}>Point de départ</Text>
              <TextInput
                style={s.input}
                value={departLabel}
                onChangeText={setDepartLabel}
                placeholder="Adresse de départ"
                placeholderTextColor={colors.muted}
              />

              {/* Destination */}
              {loadingCoords ? (
                <ActivityIndicator color={colors.accent} style={{ marginVertical: 12 }} />
              ) : (
                <AddressAutocomplete
                  label="Destination *"
                  value={arriveeLabel}
                  placeholder="Ex : Guédiawaye Golf Sud, Pikine…"
                  onChangeText={setArriveeLabel}
                  onSelect={(addr: DakarAddress) => {
                    setArriveeLabel(addr.label);
                    setCoordsArrivee({ lat: addr.lat, lng: addr.lng });
                  }}
                />
              )}

              {/* Contact */}
              <Text style={[s.fl, { marginTop: 14 }]}>Contact à l'arrivée</Text>
              <TextInput
                style={s.input}
                value={contactNom}
                onChangeText={setContactNom}
                placeholder="Nom du destinataire"
                placeholderTextColor={colors.muted}
              />
              <TextInput
                style={[s.input, { marginTop: 8 }]}
                value={contactTel}
                onChangeText={setContactTel}
                placeholder="Téléphone *"
                placeholderTextColor={colors.muted}
                keyboardType="phone-pad"
              />

              {/* Moyen de paiement */}
              <Text style={[s.fl, { marginTop: 20 }]}>Moyen de paiement</Text>
              <View style={s.payRow}>
                <PayMethodCard method="wave" selected={method === 'wave'} onSelect={() => setMethod('wave')} />
                <PayMethodCard method="om" selected={method === 'om'}   onSelect={() => setMethod('om')} />
              </View>

              <Text style={s.note}>
                Les frais de livraison sont prélevés immédiatement. LASSI rémunère le livreur séparément.
              </Text>
            </ScrollView>
          </KeyboardAvoidingView>

          <View style={s.footer}>
            <TouchableOpacity
              style={[s.payBtn, (paying || !devis || devis.horsZone || loadingCoords) && s.payBtnDisabled]}
              onPress={handlePayer}
              disabled={paying || !devis || devis.horsZone === true || loadingCoords}
              activeOpacity={0.85}
            >
              {paying
                ? <ActivityIndicator color={colors.bg} size="small" />
                : <Text style={s.payBtnTxt}>
                    Payer et demander la livraison
                    {devis && !devis.horsZone ? ` · ${formatPrice(devis.prix)}` : ''}
                  </Text>
              }
            </TouchableOpacity>
          </View>
        </>
      )}
    </LassiScreen>
  );
}

// ── Sous-composant header réutilisé ────────────────────────────────────────
function Header({ onBack, title = 'Livraison' }: { onBack: () => void; title?: string }) {
  return (
    <View style={[s.headRow, { paddingTop: TOP_INSET + 4, paddingHorizontal: 18, paddingBottom: 14 }]}>
      <TouchableOpacity style={s.backBtn} onPress={onBack} activeOpacity={0.75}>
        <IcoBack />
      </TouchableOpacity>
      <Text style={s.headTitle}>{title}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  headRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: radius.sm,
    backgroundColor: colors.surface, borderWidth: 1,
    borderColor: colors.border, alignItems: 'center', justifyContent: 'center',
  },
  headTitle: { color: colors.white, fontFamily: fonts.titleXL, fontSize: 20, flex: 1 },

  tabs: { flexDirection: 'row', gap: 6 },
  tab: {
    paddingVertical: 6, paddingHorizontal: 10, borderRadius: radius.md,
    backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border,
  },
  tabActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  tabTxt: { color: colors.muted, fontFamily: fonts.label, fontSize: 11 },
  tabTxtActive: { color: colors.bg },

  devisBanner: {
    backgroundColor: colors.accent + '18', borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.accent + '44',
    padding: 14, alignItems: 'center', marginBottom: 20,
  },
  devisLabel: { color: colors.muted, fontFamily: fonts.label, fontSize: 12 },
  devisPrix:  { color: colors.accent, fontFamily: fonts.title, fontSize: 28, marginTop: 4 },
  devisKm:    { color: colors.muted, fontFamily: fonts.label, fontSize: 11, marginTop: 2 },

  horsZone: { backgroundColor: colors.danger + '18', borderColor: colors.danger + '44' },
  horsZoneTxt: { color: colors.danger, fontFamily: fonts.label, fontSize: 12, textAlign: 'center' },

  fl: { color: colors.muted, fontFamily: fonts.label, fontSize: 12, marginBottom: 6 },
  fv: { color: colors.white, fontFamily: fonts.body },
  fm: { color: colors.muted, fontFamily: fonts.label, fontSize: 11, marginTop: 2 },

  input: {
    backgroundColor: colors.bg, borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 14, paddingVertical: 12,
    color: colors.white, fontFamily: fonts.body, fontSize: 14,
  },

  payRow: { marginTop: 8 },

  note: {
    color: colors.muted, fontFamily: fonts.label, fontSize: 11,
    marginTop: 20, textAlign: 'center', lineHeight: 16,
  },

  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 14, paddingBottom: 20,
    backgroundColor: 'rgba(20,21,42,.97)',
  },
  payBtn: {
    height: 55, borderRadius: radius.lg,
    backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center',
  },
  payBtnDisabled: { opacity: 0.45 },
  payBtnTxt: { color: colors.bg, fontFamily: fonts.ui, fontSize: 14 },

  // Listes
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyTxt: { color: colors.muted, fontFamily: fonts.body, fontSize: 14, textAlign: 'center' },
  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, padding: 14, gap: 4,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  badge: { borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  badgeTxt: { fontFamily: fonts.label, fontSize: 10 },
  cardPrix: { color: colors.accent, fontFamily: fonts.title, fontSize: 16 },

  // Success
  successTitle: { color: colors.white, fontFamily: fonts.title, fontSize: 22, textAlign: 'center' },
  successSub:   { color: colors.muted, fontFamily: fonts.body, fontSize: 14, textAlign: 'center', marginTop: 10, lineHeight: 20 },
  newBtn: {
    marginTop: 28, backgroundColor: colors.accent,
    borderRadius: radius.lg, paddingVertical: 14, paddingHorizontal: 32,
  },
  newBtnTxt: { color: colors.bg, fontFamily: fonts.ui, fontSize: 15 },

  // Waiting
  waitTitle: { color: colors.white, fontFamily: fonts.title, fontSize: 20, textAlign: 'center' },
  waitSub:   { color: colors.muted, fontFamily: fonts.body, fontSize: 13, textAlign: 'center', marginTop: 10, lineHeight: 20, paddingHorizontal: 20 },
  verifyBtn: {
    marginTop: 24, backgroundColor: colors.accent,
    borderRadius: radius.lg, paddingVertical: 14, paddingHorizontal: 32,
    minWidth: 200, alignItems: 'center',
  },
  verifyBtnTxt: { color: colors.bg, fontFamily: fonts.ui, fontSize: 14 },
  cancelTxt: { color: colors.muted, fontFamily: fonts.label, fontSize: 13 },
});
