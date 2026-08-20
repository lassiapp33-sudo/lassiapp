import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Alert,
  Linking,
  Image,
  Platform,
} from 'react-native';
import Svg, { Path, Circle, Rect, Ellipse } from 'react-native-svg';
import { royal as r } from '../theme';
import { TOP_INSET } from '../../theme';
import {
  getRestaurantSpaces,
  getAvailableSlots,
  createTableReservation,
} from '../../services/tableReservations';
import {
  RestaurantSpace,
  RestaurantTimeSlot,
  TableReservationMotif,
  TableSpecialOption,
  MOTIF_LABEL,
  OPTION_LABEL,
} from '../../types/tableReservation';
import { getErrorMessage } from '../../utils/errorUtils';
import logger from '../../utils/logger';
import { WAVE_ENABLED } from '../../config/features';

// ─── Helpers date ─────────────────────────────────────────────────────────────

const DAYS_FR = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const MONTHS_FR = ['jan', 'fev', 'mar', 'avr', 'mai', 'juin', 'juil', 'aou', 'sep', 'oct', 'nov', 'dec'];

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDateLong(d: Date): string {
  return `${DAYS_FR[d.getDay()]} ${d.getDate()} ${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const MOTIFS: TableReservationMotif[] = ['anniversaire', 'mariage', 'fiancailles', 'fete_surprise', 'affaires', 'romantique', 'autre'];
const OPTIONS: TableSpecialOption[] = ['bougie', 'emplacement_intime', 'chaise_haute', 'decoration_table'];
const WAVE_LOGO  = require('../../../assets/wave.jpg');
const OM_LOGO    = require('../../../assets/om.png');
const ACOMPTE    = 3000;
const FRAIS      = 200;
const TOTAL      = 3200;

// ─── Icônes ──────────────────────────────────────────────────────────────────

const IcoBack = () => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none"
    stroke={r.couleur.or} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M15 18l-6-6 6-6" />
  </Svg>
);

// ─── Couleurs icônes ─────────────────────────────────────────────────────────

const IC      = '#FDCF34';
const IC_FILL = '#FDCF3440';

// ─── Icônes Motifs ────────────────────────────────────────────────────────────

const IcoAnniversaire = () => (
  <Svg width={22} height={22} viewBox="0 0 24 24">
    <Path d="M12 2c-.7 1.3-1.5 2.8-1.5 4s.7 2 1.5 2 1.5-.8 1.5-2S12.7 3.3 12 2z" fill={IC}/>
    <Path d="M12 8v1.5" stroke={IC} strokeWidth={1.5} strokeLinecap="round"/>
    <Rect x="4" y="9.5" width="16" height="10" rx="1.5" stroke={IC} strokeWidth={1.5} fill={IC_FILL}/>
    <Path d="M4 14q2-2 4 0t4 0 4 0" stroke={IC} strokeWidth={1.2} fill="none" strokeLinecap="round"/>
    <Path d="M2 20h20" stroke={IC} strokeWidth={1.5} strokeLinecap="round"/>
  </Svg>
);

const IcoMariage = () => (
  <Svg width={22} height={22} viewBox="0 0 24 24">
    <Circle cx="9" cy="12" r="5.5" stroke={IC} strokeWidth={1.8} fill="none"/>
    <Circle cx="15" cy="12" r="5.5" stroke={IC} strokeWidth={1.8} fill="none"/>
  </Svg>
);

const IcoFiancailles = () => (
  <Svg width={22} height={22} viewBox="0 0 24 24">
    <Path d="M8.5 5h7l3 5H5.5z" stroke={IC} strokeWidth={1.5} fill={IC_FILL} strokeLinejoin="round"/>
    <Path d="M5.5 10l6.5 10 6.5-10z" stroke={IC} strokeWidth={1.5} fill={IC_FILL} strokeLinejoin="round"/>
    <Path d="M5.5 10h13" stroke={IC} strokeWidth={1.5}/>
    <Path d="M12 10l-2.5-5M12 10l2.5-5M12 10v10" stroke={IC} strokeWidth={1} opacity={0.5} strokeLinecap="round"/>
  </Svg>
);

const IcoFeteSurprise = () => (
  <Svg width={22} height={22} viewBox="0 0 24 24">
    <Circle cx="12" cy="9" r="6" stroke={IC} strokeWidth={1.5} fill={IC_FILL}/>
    <Path d="M12 15v5" stroke={IC} strokeWidth={1.5} strokeLinecap="round"/>
    <Path d="M10 20h4" stroke={IC} strokeWidth={1.5} strokeLinecap="round"/>
    <Path d="M19 2l.5 2-2-.5" stroke={IC} strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round"/>
    <Path d="M5 2l-.5 2 2-.5" stroke={IC} strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round"/>
    <Circle cx="20" cy="7.5" r="1" fill={IC}/>
    <Circle cx="4" cy="7.5" r="1" fill={IC}/>
  </Svg>
);

const IcoAffaires = () => (
  <Svg width={22} height={22} viewBox="0 0 24 24">
    <Rect x="2" y="8" width="20" height="14" rx="2" stroke={IC} strokeWidth={1.5} fill={IC_FILL}/>
    <Path d="M16 8V6a4 4 0 0 0-8 0v2" stroke={IC} strokeWidth={1.5} fill="none"/>
    <Path d="M2 14h20" stroke={IC} strokeWidth={1.5}/>
    <Rect x="10" y="12" width="4" height="4" rx="0.5" stroke={IC} strokeWidth={1.2} fill="none"/>
  </Svg>
);

const IcoRomantique = () => (
  <Svg width={22} height={22} viewBox="0 0 24 24">
    <Path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" fill={IC_FILL} stroke={IC} strokeWidth={1.5} strokeLinejoin="round"/>
  </Svg>
);

const IcoAutre = () => (
  <Svg width={22} height={22} viewBox="0 0 24 24">
    <Path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" fill={IC_FILL} stroke={IC} strokeWidth={1.5} strokeLinejoin="round"/>
  </Svg>
);

// ─── Icônes Options ───────────────────────────────────────────────────────────

const IcoBougie = () => (
  <Svg width={20} height={20} viewBox="0 0 24 24">
    <Path d="M12 2c-1 1.8-1.5 3.5-1.5 5s.7 2.5 1.5 2.5 1.5-1 1.5-2.5S13 3.8 12 2z" fill={IC}/>
    <Path d="M12 9.5v1" stroke={IC} strokeWidth={1.5} strokeLinecap="round"/>
    <Rect x="8" y="10.5" width="8" height="11" rx="1" stroke={IC} strokeWidth={1.5} fill={IC_FILL}/>
    <Path d="M10 10.5v1.5a1 1 0 0 0 1 1" stroke={IC} strokeWidth={1} strokeLinecap="round" fill="none"/>
  </Svg>
);

const IcoCadenas = () => (
  <Svg width={20} height={20} viewBox="0 0 24 24">
    <Rect x="5" y="11" width="14" height="11" rx="2" stroke={IC} strokeWidth={1.5} fill={IC_FILL}/>
    <Path d="M8 11V7a4 4 0 0 1 8 0v4" stroke={IC} strokeWidth={1.5} fill="none"/>
    <Circle cx="12" cy="16" r="1.5" fill={IC}/>
    <Path d="M12 17.5v2" stroke={IC} strokeWidth={1.5} strokeLinecap="round"/>
  </Svg>
);

const IcoChaisseHaute = () => (
  <Svg width={20} height={20} viewBox="0 0 24 24">
    <Path d="M7 9V4h10v5" stroke={IC} strokeWidth={1.5} strokeLinecap="round" fill="none"/>
    <Rect x="5" y="9" width="14" height="5" rx="1" stroke={IC} strokeWidth={1.5} fill={IC_FILL}/>
    <Path d="M3 11.5h18" stroke={IC} strokeWidth={1.5} strokeLinecap="round"/>
    <Path d="M7 14l-1.5 6.5M17 14l1.5 6.5" stroke={IC} strokeWidth={1.5} strokeLinecap="round"/>
    <Path d="M6.5 19h11" stroke={IC} strokeWidth={1.5} strokeLinecap="round"/>
  </Svg>
);

const IcoDecoration = () => (
  <Svg width={20} height={20} viewBox="0 0 24 24">
    <Ellipse cx="12" cy="6.5" rx="2.5" ry="3.5" fill={IC_FILL} stroke={IC} strokeWidth={1.2}/>
    <Ellipse cx="12" cy="17.5" rx="2.5" ry="3.5" fill={IC_FILL} stroke={IC} strokeWidth={1.2}/>
    <Ellipse cx="6.5" cy="12" rx="3.5" ry="2.5" fill={IC_FILL} stroke={IC} strokeWidth={1.2}/>
    <Ellipse cx="17.5" cy="12" rx="3.5" ry="2.5" fill={IC_FILL} stroke={IC} strokeWidth={1.2}/>
    <Circle cx="12" cy="12" r="3" fill={IC}/>
    <Circle cx="12" cy="12" r="1.5" fill={IC_FILL}/>
  </Svg>
);

// ─── Maps icônes ──────────────────────────────────────────────────────────────

const MOTIF_ICON: Record<TableReservationMotif, React.ComponentType> = {
  anniversaire:  IcoAnniversaire,
  mariage:       IcoMariage,
  fiancailles:   IcoFiancailles,
  fete_surprise: IcoFeteSurprise,
  affaires:      IcoAffaires,
  romantique:    IcoRomantique,
  autre:         IcoAutre,
};

const OPTION_ICON: Record<TableSpecialOption, React.ComponentType> = {
  bougie:             IcoBougie,
  emplacement_intime: IcoCadenas,
  chaise_haute:       IcoChaisseHaute,
  decoration_table:   IcoDecoration,
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  vipProfilId: string;
  vipNom: string;
  onBack: () => void;
  onSuccess: (reservationId: string) => void;
}

// ─── Écran principal ─────────────────────────────────────────────────────────

export default function ReservationFlowScreen({ vipProfilId, vipNom, onBack, onSuccess }: Props) {
  // Date = aujourd'hui, fixe (réservations sur 24h)
  const selectedDate = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // Step 1: Space + Slot
  const [spaces, setSpaces]     = useState<RestaurantSpace[]>([]);
  const [slots, setSlots]       = useState<RestaurantTimeSlot[]>([]);
  const [loadingSpaces, setLoadingSpaces] = useState(false);
  const [loadingSlots, setLoadingSlots]   = useState(false);
  const [selectedSpace, setSelectedSpace] = useState<RestaurantSpace | null>(null);
  const [selectedSlot, setSelectedSlot]   = useState<RestaurantTimeSlot | null>(null);

  // Step 3: Guests + Motif + Options
  const [nbPersonnes, setNbPersonnes]         = useState(2);
  const [motif, setMotif]                     = useState<TableReservationMotif | null>(null);
  const [detailsMotif, setDetailsMotif]       = useState('');
  const [options, setOptions]                 = useState<TableSpecialOption[]>([]);

  // Step 4: Payment
  const [payMethod, setPayMethod] = useState<'wave' | 'orange_money'>(WAVE_ENABLED ? 'wave' : 'orange_money');
  const [loading, setLoading]     = useState(false);
  const [step, setStep]           = useState(1);

  // Charger espaces au montage
  useEffect(() => {
    setLoadingSpaces(true);
    getRestaurantSpaces(vipProfilId)
      .then(setSpaces)
      .catch(err => logger.warn('[ReservationFlow] espaces:', err))
      .finally(() => setLoadingSpaces(false));
  }, [vipProfilId]);

  // Charger créneaux au montage (date fixe = aujourd'hui)
  useEffect(() => {
    setLoadingSlots(true);
    getAvailableSlots(vipProfilId, toDateStr(selectedDate))
      .then(setSlots)
      .catch(err => logger.warn('[ReservationFlow] slots:', err))
      .finally(() => setLoadingSlots(false));
  }, [vipProfilId, selectedDate]);

  const toggleOption = (opt: TableSpecialOption) => {
    setOptions(prev =>
      prev.includes(opt) ? prev.filter(o => o !== opt) : [...prev, opt]
    );
  };

  const canGoStep2 = selectedSlot != null;

  const canGoStep3 = nbPersonnes >= 1 && nbPersonnes <= 100;

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const result = await createTableReservation({
        vipProfilId,
        spaceId:        selectedSpace?.id,
        timeSlotId:     selectedSlot?.id,
        dateReservation: toDateStr(selectedDate),
        heureDebut:     selectedSlot?.heure_debut?.slice(0, 5) ?? '12:00',
        nbPersonnes,
        motif:          motif ?? undefined,
        detailsMotif:   detailsMotif.trim() || undefined,
        optionsSpeciales: options,
        moyenPaiement:  payMethod,
      });

      if (result.mode === 'simulation') {
        onSuccess(result.reservationId);
        return;
      }

      // Production : ouvrir l'URL de paiement (Wave ou OM deeplink)
      if (result.redirectUrl) {
        await Linking.openURL(result.redirectUrl);
        onSuccess(result.reservationId);
        return;
      }

      // OM sans deeplink (QR code affiché côté serveur) ou cas inconnu
      onSuccess(result.reservationId);

    } catch (err) {
      Alert.alert('Erreur', getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // ── Rendu par étape ──────────────────────────────────────────────────────────

  return (
    <View style={s.root}>
      {/* En-tête */}
      <View style={[s.header, { paddingTop: TOP_INSET + 4 }]}>
        <TouchableOpacity onPress={onBack} hitSlop={12} style={s.backBtn}>
          <IcoBack />
        </TouchableOpacity>
        <View>
          <Text style={s.headerTitle}>Réserver une table</Text>
          <Text style={s.headerSub}>{vipNom}</Text>
        </View>
        {/* Indicateur étape */}
        <View style={s.stepBadge}>
          <Text style={s.stepBadgeTxt}>{step}/3</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* ── ÉTAPE 1 : Espace + Créneau ───────────────────────────────────── */}
        {step >= 1 && (
          <>
            {/* Espaces */}
            {loadingSpaces ? (
              <ActivityIndicator color={r.couleur.or} style={{ marginVertical: 12 }} />
            ) : spaces.length > 0 ? (
              <>
                <Text style={s.sectionTitle}>Choisissez un espace</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.dateScroll}>
                  {spaces.map(sp => {
                    const sel = selectedSpace?.id === sp.id;
                    return (
                      <TouchableOpacity
                        key={sp.id}
                        style={[s.spaceCard, sel && s.spaceCardOn]}
                        onPress={() => setSelectedSpace(sp)}
                        activeOpacity={0.8}
                      >
                        {sp.photo_url ? (
                          <Image source={{ uri: sp.photo_url }} style={s.spaceImg} resizeMode="cover" />
                        ) : (
                          <View style={s.spaceImgPlaceholder} />
                        )}
                        <Text style={[s.spaceName, sel && s.spaceNameOn]}>{sp.nom}</Text>
                        {sp.capacite != null && (
                          <Text style={[s.spaceCap, sel && s.spaceCapOn]}>≤ {sp.capacite} pers.</Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </>
            ) : null}

            {/* Créneaux */}
            <Text style={s.sectionTitle}>Choisissez un créneau</Text>
            {loadingSlots ? (
              <ActivityIndicator color={r.couleur.or} style={{ marginVertical: 12 }} />
            ) : slots.length === 0 ? (
              <View style={s.emptyBox}>
                <Text style={s.emptyTxt}>Aucun créneau disponible ce jour.</Text>
                <Text style={s.emptyTxt}>Essayez une autre date.</Text>
              </View>
            ) : (
              <View style={s.slotsGrid}>
                {slots.map(sl => {
                  const sel = selectedSlot?.id === sl.id;
                  return (
                    <TouchableOpacity
                      key={sl.id}
                      style={[s.slotChip, sel && s.slotChipOn]}
                      onPress={() => setSelectedSlot(sl)}
                      activeOpacity={0.8}
                    >
                      <Text style={[s.slotLabel, sel && s.slotLabelOn]}>{sl.label}</Text>
                      <Text style={[s.slotTime, sel && s.slotTimeOn]}>
                        {sl.heure_debut?.slice(0, 5)} – {sl.heure_fin?.slice(0, 5)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {step === 1 && canGoStep2 && (
              <TouchableOpacity style={s.nextBtn} onPress={() => setStep(2)} activeOpacity={0.85}>
                <Text style={s.nextBtnTxt}>Continuer</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {/* ── ÉTAPE 2 : Convives + Motif + Options ─────────────────────────── */}
        {step >= 2 && (
          <>
            {/* Nombre de personnes */}
            <Text style={s.sectionTitle}>Nombre de personnes</Text>
            <View style={s.counterRow}>
              <TouchableOpacity
                style={s.counterBtn}
                onPress={() => setNbPersonnes(n => Math.max(1, n - 1))}
                activeOpacity={0.8}
              >
                <Text style={s.counterBtnTxt}>−</Text>
              </TouchableOpacity>
              <Text style={s.counterVal}>{nbPersonnes}</Text>
              <TouchableOpacity
                style={s.counterBtn}
                onPress={() => setNbPersonnes(n => Math.min(100, n + 1))}
                activeOpacity={0.8}
              >
                <Text style={s.counterBtnTxt}>+</Text>
              </TouchableOpacity>
            </View>

            {/* Motif (optionnel) */}
            <Text style={s.sectionTitle}>Occasion (optionnel)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.dateScroll}>
              {MOTIFS.map(m => {
                const sel = motif === m;
                const MotifIcon = MOTIF_ICON[m];
                return (
                  <TouchableOpacity
                    key={m}
                    style={[s.motifChip, sel && s.motifChipOn]}
                    onPress={() => setMotif(sel ? null : m)}
                    activeOpacity={0.8}
                  >
                    <MotifIcon />
                    <Text style={[s.motifLabel, sel && s.motifLabelOn]}>{MOTIF_LABEL[m]}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {motif && (
              <TextInput
                style={s.textInput}
                placeholder="Précisez si besoin (ex : 30 ans, prénom, etc.)"
                placeholderTextColor={r.couleur.gris}
                value={detailsMotif}
                onChangeText={setDetailsMotif}
                maxLength={300}
              />
            )}

            {/* Options spéciales */}
            <Text style={s.sectionTitle}>Demandes spéciales (optionnel)</Text>
            <View style={s.optionsGrid}>
              {OPTIONS.map(opt => {
                const sel = options.includes(opt);
                const OptIcon = OPTION_ICON[opt];
                return (
                  <TouchableOpacity
                    key={opt}
                    style={[s.optionChip, sel && s.optionChipOn]}
                    onPress={() => toggleOption(opt)}
                    activeOpacity={0.8}
                  >
                    <OptIcon />
                    <Text style={[s.optionLabel, sel && s.optionLabelOn]}>{OPTION_LABEL[opt]}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {step === 2 && canGoStep3 && (
              <TouchableOpacity style={s.nextBtn} onPress={() => setStep(3)} activeOpacity={0.85}>
                <Text style={s.nextBtnTxt}>Continuer</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {/* ── ÉTAPE 3 : Paiement ───────────────────────────────────────────── */}
        {step >= 3 && (
          <>
            {/* Récapitulatif */}
            <Text style={s.sectionTitle}>Récapitulatif</Text>
            <View style={s.summaryCard}>
              <SummaryRow label="Restaurant"  value={vipNom} />
              <SummaryRow label="Date"        value={formatDateLong(selectedDate)} />
              {selectedSpace  && <SummaryRow label="Espace"     value={selectedSpace.nom} />}
              {selectedSlot   && <SummaryRow label="Créneau"    value={`${selectedSlot.label} — ${selectedSlot.heure_debut?.slice(0, 5)} à ${selectedSlot.heure_fin?.slice(0, 5)}`} />}
              <SummaryRow label="Convives"    value={`${nbPersonnes} personne${nbPersonnes > 1 ? 's' : ''}`} />
              {motif          && <SummaryRow label="Occasion"   value={MOTIF_LABEL[motif]} />}
              <View style={s.summaryDivider} />
              <SummaryRow label="Acompte"     value="3 000 FCFA" />
              <SummaryRow label="Frais LASSI" value="200 FCFA" />
              <SummaryRow label="Total"       value="3 200 FCFA" accent />
              <View style={s.acompteNotice}>
                <Text style={s.acompteNoticeTitle}>
                  Pas d'inquiétude pour les{' '}
                  <Text style={s.acompteNoticeHighlight}>3 000 F</Text>
                </Text>

                <Text style={s.acompteNoticeBody}>
                  Cet argent n'est <Text style={s.acompteNoticeHighlight}>PAS en plus.</Text>{'\n'}
                  Il sera <Text style={s.acompteNoticeHighlight}>DÉDUIT</Text> de ton addition{'\n'}
                  quand tu arriveras au restaurant.
                </Text>

                <View style={s.acompteExemple}>
                  <Text style={s.acompteExempleTitle}>Exemple :</Text>
                  <Text style={s.acompteExempleLigne}>
                    Note totale {'       '}= <Text style={s.acompteNoticeHighlight}>15 000 F</Text>
                  </Text>
                  <Text style={s.acompteExempleLigne}>
                    Moins tes 3 000 F = <Text style={s.acompteNoticeHighlight}>− 3 000 F</Text>
                  </Text>
                  <View style={s.acompteExempleDivider} />
                  <Text style={s.acompteExempleTotal}>
                    Tu paies sur place = <Text style={s.acompteNoticeHighlight}>12 000 F</Text> ✅
                  </Text>
                </View>
              </View>
            </View>

            {/* Méthode de paiement */}
            <Text style={s.sectionTitle}>Moyen de paiement</Text>
            <View style={s.methodsRow}>
              {(['wave', 'orange_money'] as const).filter(m => m !== 'wave' || WAVE_ENABLED).map(m => (
                <TouchableOpacity
                  key={m}
                  style={[s.methodCard, payMethod === m && s.methodCardOn]}
                  onPress={() => setPayMethod(m)}
                  activeOpacity={0.8}
                >
                  <Image
                    source={m === 'wave' ? WAVE_LOGO : OM_LOGO}
                    style={s.methodLogo}
                    resizeMode="cover"
                  />
                  <Text style={[s.methodLabel, payMethod === m && s.methodLabelOn]}>
                    {m === 'wave' ? 'Wave' : 'Orange Money'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[s.confirmBtn, loading && { opacity: 0.6 }]}
              onPress={handleConfirm}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color={r.couleur.encre} />
                : <Text style={s.confirmBtnTxt}>Payer 3 200 FCFA et réserver</Text>
              }
            </TouchableOpacity>

            <Text style={s.legalNote}>
              En confirmant, vous acceptez que l'acompte (3 000 FCFA) soit remboursé si le restaurant refuse votre demande.
            </Text>
          </>
        )}

        <View style={{ height: Platform.OS === 'ios' ? 40 : 20 }} />
      </ScrollView>
    </View>
  );
}

// ─── Sous-composants ──────────────────────────────────────────────────────────

function SummaryRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={s.summaryRow}>
      <Text style={s.summaryKey}>{label}</Text>
      <Text style={[s.summaryVal, accent && s.summaryValAccent]}>{value}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:  { flex: 1, backgroundColor: r.couleur.encre },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: r.couleur.filet,
  },
  backBtn: {
    width: 38, height: 38,
    borderRadius: 8,
    backgroundColor: r.couleur.velours,
    borderWidth: 1,
    borderColor: r.couleur.filet,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { color: r.couleur.ivoire, fontFamily: r.police.titre, fontSize: 15 },
  headerSub:   { color: r.couleur.gris,   fontFamily: r.police.util,  fontSize: 12, marginTop: 1 },
  stepBadge: {
    marginLeft: 'auto',
    backgroundColor: r.couleur.velours,
    borderWidth: 1,
    borderColor: r.couleur.filet,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  stepBadgeTxt: { color: r.couleur.or, fontFamily: r.police.util, fontSize: 12 },

  content: { paddingHorizontal: 18, paddingTop: 20 },

  sectionTitle: {
    color: r.couleur.orClair,
    fontFamily: r.police.util,
    fontSize: 10,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    marginBottom: 10,
    marginTop: 20,
  },

  // Date picker
  dateScroll: { marginBottom: 4 },
  dateChip: {
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: r.couleur.filet,
    backgroundColor: r.couleur.velours,
    marginRight: 8,
    minWidth: 56,
  },
  dateChipOn:      { borderColor: r.couleur.or, backgroundColor: `${r.couleur.or}18` },
  dateDayLabel:    { color: r.couleur.gris,   fontFamily: r.police.util, fontSize: 10, textTransform: 'uppercase' },
  dateDayLabelOn:  { color: r.couleur.or },
  dateDayNum:      { color: r.couleur.ivoire, fontFamily: r.police.titre, fontSize: 18, marginVertical: 1 },
  dateDayNumOn:    { color: r.couleur.or },
  dateMonthLabel:  { color: r.couleur.gris,   fontFamily: r.police.util, fontSize: 10 },
  dateMonthLabelOn:{ color: r.couleur.or },

  // Espaces
  spaceCard: {
    paddingBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: r.couleur.filet,
    backgroundColor: r.couleur.velours,
    marginRight: 12,
    width: 220,
    alignItems: 'center',
    overflow: 'hidden',
  },
  spaceCardOn:  { borderColor: r.couleur.or, backgroundColor: `${r.couleur.or}18` },
  spaceImg: {
    width: 220,
    height: 150,
    marginBottom: 8,
    backgroundColor: r.couleur.filet,
  },
  spaceImgPlaceholder: {
    width: 220,
    height: 150,
    marginBottom: 8,
    backgroundColor: r.couleur.filet,
  },
  spaceName:    { color: r.couleur.ivoire, fontFamily: r.police.util, fontSize: 13, textAlign: 'center', paddingHorizontal: 8 },
  spaceNameOn:  { color: r.couleur.or },
  spaceCap:     { color: r.couleur.gris,   fontFamily: r.police.util, fontSize: 11, marginTop: 4 },
  spaceCapOn:   { color: r.couleur.orClair },

  // Créneaux
  slotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 4 },
  slotChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: r.couleur.filet,
    backgroundColor: r.couleur.velours,
    alignItems: 'center',
    minWidth: 130,
  },
  slotChipOn:  { borderColor: r.couleur.or, backgroundColor: `${r.couleur.or}18` },
  slotLabel:   { color: r.couleur.ivoire, fontFamily: r.police.util, fontSize: 13 },
  slotLabelOn: { color: r.couleur.or },
  slotTime:    { color: r.couleur.gris,   fontFamily: r.police.util, fontSize: 11, marginTop: 3 },
  slotTimeOn:  { color: r.couleur.orClair },

  // Vide
  emptyBox: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: r.couleur.filetFin,
  },
  emptyTxt: { color: r.couleur.gris, fontFamily: r.police.util, fontSize: 13, marginBottom: 4 },

  // Counter personnes
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
    justifyContent: 'center',
    paddingVertical: 8,
  },
  counterBtn: {
    width: 44, height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: r.couleur.or,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterBtnTxt: { color: r.couleur.or, fontFamily: r.police.titre, fontSize: 22 },
  counterVal:    { color: r.couleur.ivoire, fontFamily: r.police.titre, fontSize: 32, minWidth: 50, textAlign: 'center' },

  // Motifs
  motifChip: {
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: r.couleur.filet,
    backgroundColor: r.couleur.velours,
    marginRight: 8,
    minWidth: 90,
  },
  motifChipOn:   { borderColor: r.couleur.or, backgroundColor: `${r.couleur.or}18` },
  motifLabel:    { color: r.couleur.gris,   fontFamily: r.police.util, fontSize: 11, textAlign: 'center', marginTop: 4 },
  motifLabelOn:  { color: r.couleur.or },

  textInput: {
    borderWidth: 1,
    borderColor: r.couleur.filet,
    borderRadius: 8,
    padding: 12,
    color: r.couleur.ivoire,
    fontFamily: r.police.util,
    fontSize: 13,
    backgroundColor: r.couleur.velours,
    marginTop: 8,
  },

  // Options spéciales
  optionsGrid: { gap: 8, marginBottom: 4 },
  optionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: r.couleur.filet,
    backgroundColor: r.couleur.velours,
  },
  optionChipOn:   { borderColor: r.couleur.or, backgroundColor: `${r.couleur.or}12` },
  optionLabel:    { color: r.couleur.gris,   fontFamily: r.police.util, fontSize: 13 },
  optionLabelOn:  { color: r.couleur.orClair },

  // Récapitulatif
  summaryCard: {
    borderWidth: 1,
    borderColor: r.couleur.filet,
    borderRadius: 10,
    padding: 14,
    backgroundColor: r.couleur.velours,
    gap: 8,
  },
  summaryRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  summaryKey:      { color: r.couleur.gris,   fontFamily: r.police.util, fontSize: 12, flex: 1 },
  summaryVal:      { color: r.couleur.ivoire, fontFamily: r.police.util, fontSize: 12, textAlign: 'right', flex: 1 },
  summaryValAccent:{ color: r.couleur.orLassi, fontFamily: r.police.titre, fontSize: 15 },
  summaryDivider:  { height: 1, backgroundColor: r.couleur.filetFin, marginVertical: 4 },
  acompteNotice: {
    marginTop: 14,
    backgroundColor: 'rgba(253, 207, 52, 0.10)',
    borderWidth: 2,
    borderColor: r.couleur.orLassi,
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  acompteNoticeTitle: {
    color: r.couleur.ivoire,
    fontFamily: r.police.titre,
    fontSize: 17,
    lineHeight: 24,
  },
  acompteNoticeBody: {
    color: r.couleur.ivoire,
    fontFamily: r.police.util,
    fontSize: 15,
    lineHeight: 24,
  },
  acompteNoticeHighlight: {
    color: r.couleur.orLassi,
    fontFamily: r.police.titre,
    fontSize: 15,
  },
  // Bloc exemple chiffré
  acompteExemple: {
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 8,
    padding: 12,
    gap: 4,
  },
  acompteExempleTitle: {
    color: r.couleur.orLassi,
    fontFamily: r.police.titre,
    fontSize: 13,
    marginBottom: 4,
  },
  acompteExempleLigne: {
    color: r.couleur.ivoire,
    fontFamily: r.police.util,
    fontSize: 14,
    lineHeight: 22,
  },
  acompteExempleDivider: {
    height: 1,
    backgroundColor: r.couleur.orLassi,
    opacity: 0.4,
    marginVertical: 4,
  },
  acompteExempleTotal: {
    color: r.couleur.ivoire,
    fontFamily: r.police.titre,
    fontSize: 15,
    lineHeight: 22,
  },
  // Conservé mais inutilisé
  acompteEquation:   {},
  acompteEqCol:      {},
  acompteEqNumber:   {},
  acompteEqLabel:    {},
  acompteEqOp:       {},
  acompteNoticeFinal:{},
  acompteNoticeSub:  {},

  // Méthodes de paiement
  methodsRow: { flexDirection: 'row', gap: 12, marginBottom: 4 },
  methodCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: r.couleur.filet,
    backgroundColor: r.couleur.velours,
    gap: 6,
  },
  methodCardOn:   { borderColor: r.couleur.or },
  methodLogo:     { width: 48, height: 48, borderRadius: 8 },
  methodLabel:    { color: r.couleur.gris,   fontFamily: r.police.util, fontSize: 12 },
  methodLabelOn:  { color: r.couleur.or },

  // Bouton confirmer
  confirmBtn: {
    height: 56,
    borderRadius: 10,
    backgroundColor: r.couleur.orLassi,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  confirmBtnTxt: { color: r.couleur.encre, fontFamily: r.police.titre, fontSize: 15 },
  legalNote: {
    color: r.couleur.gris,
    fontFamily: r.police.util,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 16,
  },

  // Bouton continuer
  nextBtn: {
    height: 50,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: r.couleur.or,
    backgroundColor: `${r.couleur.or}18`,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  nextBtnTxt: { color: r.couleur.or, fontFamily: r.police.titre, fontSize: 14 },
});
