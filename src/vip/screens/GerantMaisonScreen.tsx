import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { royal as r } from '../theme';
import { VIP_FONTS } from '../useVipFonts';
import { getMonProfilVip, updateProfilEditorial } from '../../services/vip';
import useGerantStore from '../../store/gerantStore';
import { TOP_INSET } from '../../theme';
import { VipCategorie } from '../../types/vip';

const MAISON_SUGGESTIONS: Record<VipCategorie, { baseline: string; motGerant: string }> = {
  restauration: {
    baseline:  'Ex : Cuisine sénégalaise raffinée',
    motGerant: 'Ex : Nous accueillons chaque client comme un hôte de marque...',
  },
  beaute_tressage: {
    baseline:  'Ex : Tressage africain haut de gamme',
    motGerant: 'Ex : Chaque cliente repart sublimée, c\'est notre engagement...',
  },
  coiffure: {
    baseline:  'Ex : Coiffure & soins capillaires premium',
    motGerant: 'Ex : Votre cheveu mérite le meilleur traitement...',
  },
  musculation_fitness: {
    baseline:  'Ex : Salle de sport moderne au cœur de Dakar',
    motGerant: 'Ex : Ici, chaque séance vous rapproche de votre meilleure version...',
  },
  boulangerie_patisserie: {
    baseline:  'Ex : Pains artisanaux & pâtisseries fines',
    motGerant: 'Ex : Nos produits sont faits maison, avec amour, chaque matin...',
  },
};

const IcoBack = () => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none"
    stroke={r.couleur.or} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M15 18l-6-6 6-6" />
  </Svg>
);

interface Props {
  onBack: () => void;
  onPreview: () => void;
}

export default function GerantMaisonScreen({ onBack, onPreview }: Props) {
  const profilStore = useGerantStore(s => s.profil);
  const setGerant = useGerantStore(s => s.setGerant);
  const sg = MAISON_SUGGESTIONS[profilStore?.categorie as VipCategorie] ?? MAISON_SUGGESTIONS.restauration;

  const [profilId, setProfilId] = useState<string | null>(null);
  const [initiale, setInitiale] = useState(profilStore?.initiale ?? '');
  const [baseline, setBaseline] = useState(profilStore?.baseline ?? '');
  const [motDuGerant, setMotDuGerant] = useState(profilStore?.motDuGerant ?? '');
  const [signatureMot, setSignatureMot] = useState(profilStore?.signatureMot ?? '');
  const [chargement, setChargement] = useState(true);
  const [sauvegarde, setSauvegarde] = useState(false);

  const charger = useCallback(async () => {
    const profil = await getMonProfilVip();
    if (profil) {
      setProfilId(profil.id);
      setInitiale(profil.initiale);
      setBaseline(profil.baseline ?? '');
      setMotDuGerant(profil.motDuGerant ?? '');
      setSignatureMot(profil.signatureMot ?? '');
    }
    setChargement(false);
  }, []);

  useEffect(() => { charger(); }, [charger]);

  const enregistrer = async () => {
    if (!profilId) return;
    if (initiale.trim().length > 1) {
      Alert.alert('Initiale', 'L\'initiale doit être un seul caractère.');
      return;
    }
    setSauvegarde(true);
    try {
      await updateProfilEditorial(profilId, {
        initiale: initiale.trim().toUpperCase() || undefined,
        baseline: baseline.trim() || undefined,
        motDuGerant: motDuGerant.trim() || undefined,
        signatureMot: signatureMot.trim() || undefined,
      });
      // Rafraîchir le store gérant
      const profil = await getMonProfilVip();
      if (profil) setGerant(profil);
      Alert.alert('Enregistré', 'Votre fiche a été mise à jour.');
    } catch {
      Alert.alert('Erreur', 'Impossible d\'enregistrer les modifications.');
    } finally {
      setSauvegarde(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={s.fond}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <StatusBar barStyle="light-content" backgroundColor={r.couleur.encre} />

      {/* En-tête */}
      <View style={[s.header, { paddingTop: TOP_INSET + 12 }]}>
        <TouchableOpacity onPress={onBack} hitSlop={12} style={s.backBtn}>
          <IcoBack />
        </TouchableOpacity>
        <Text style={s.headerTitre}>Ma maison</Text>
        <View style={{ width: 32 }} />
      </View>

      {chargement ? (
        <View style={s.centre}>
          <ActivityIndicator color={r.couleur.or} />
        </View>
      ) : (
        <ScrollView keyboardShouldPersistTaps="handled" style={s.scroll}>

          <Champ
            label="Initiale (1 caractère)"
            value={initiale}
            onChange={v => setInitiale(v.slice(0, 1).toUpperCase())}
            placeholder="Ex : P"
            hint="Lettre visible dans le blason ou monogramme"
            maxLength={1}
          />

          <Champ
            label="Baseline"
            value={baseline}
            onChange={setBaseline}
            placeholder={sg.baseline}
            hint="Sous-titre court affiché sous le nom"
            multiline
          />

          <Champ
            label="Mot du gérant"
            value={motDuGerant}
            onChange={setMotDuGerant}
            placeholder={sg.motGerant}
            hint="Citation personnelle affichée sur la fiche"
            multiline
          />

          <Champ
            label="Signature du gérant"
            value={signatureMot}
            onChange={setSignatureMot}
            placeholder="Ex : Mamadou, propriétaire"
            hint="Nom affiché sous le mot du gérant"
          />

          <TouchableOpacity
            style={[s.btnSave, sauvegarde && s.btnDisabled]}
            onPress={enregistrer}
            disabled={sauvegarde}>
            {sauvegarde
              ? <ActivityIndicator color={r.couleur.encre} />
              : <Text style={s.btnSaveTxt}>Enregistrer</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={s.btnPreview} onPress={onPreview}>
            <Text style={s.btnPreviewTxt}>Aperçu de ma fiche →</Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

// ── Champ réutilisable ────────────────────────────────────────────────────────

function Champ({
  label, value, onChange, placeholder, hint, multiline, maxLength,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
  multiline?: boolean;
  maxLength?: number;
}) {
  return (
    <View style={sc.champBloc}>
      <Text style={sc.champLabel}>{label}</Text>
      {hint && <Text style={sc.champHint}>{hint}</Text>}
      <TextInput
        style={[sc.champInput, multiline && sc.inputMulti]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={r.couleur.gris}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
        maxLength={maxLength}
      />
    </View>
  );
}

const s = StyleSheet.create({
  fond:   { flex: 1, backgroundColor: r.couleur.encre },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: r.espace.md,
    paddingBottom: r.espace.md,
    borderBottomWidth: 1,
    borderBottomColor: r.couleur.filetFin,
  },
  backBtn: { width: 32, alignItems: 'flex-start' },
  headerTitre: {
    flex: 1,
    fontFamily: VIP_FONTS.palais.titre,
    fontSize: 18,
    color: r.couleur.ivoire,
    letterSpacing: 1.5,
    textAlign: 'center',
  },

  btnSave: {
    marginHorizontal: r.espace.md,
    marginTop: r.espace.md,
    backgroundColor: r.couleur.orLassi,
    paddingVertical: 15,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  btnSaveTxt: {
    fontFamily: VIP_FONTS.palais.util,
    fontSize: 14,
    color: r.couleur.encre,
    letterSpacing: 1,
  },
  btnPreview: {
    marginHorizontal: r.espace.md,
    marginTop: r.espace.sm,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: r.couleur.filet,
    alignItems: 'center',
  },
  btnPreviewTxt: {
    fontFamily: VIP_FONTS.palais.util,
    fontSize: 13,
    color: r.couleur.orClair,
    letterSpacing: 1,
  },
});

const sc = StyleSheet.create({
  champBloc: {
    paddingHorizontal: r.espace.md,
    paddingTop: r.espace.md,
  },
  champLabel: {
    fontFamily: VIP_FONTS.palais.util,
    fontSize: 11,
    letterSpacing: 2,
    color: r.couleur.orClair,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  champHint: {
    fontFamily: VIP_FONTS.palais.util,
    fontSize: 11,
    color: r.couleur.gris,
    marginBottom: 6,
  },
  champInput: {
    borderWidth: 1,
    borderColor: r.couleur.filetFin,
    backgroundColor: r.couleur.velours,
    color: r.couleur.ivoire,
    fontFamily: VIP_FONTS.palais.util,
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  inputMulti: {
    height: 80,
    textAlignVertical: 'top',
  },
});
