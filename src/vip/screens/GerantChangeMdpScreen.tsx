import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
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
import { changerMotDePasse } from '../authVip';
import { TOP_INSET } from '../../theme';

const IcoBack = () => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none"
    stroke={r.couleur.or} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M15 18l-6-6 6-6" />
  </Svg>
);

interface Props {
  onBack: () => void;
}

export default function GerantChangeMdpScreen({ onBack }: Props) {
  const [nouveau, setNouveau] = useState('');
  const [confirmer, setConfirmer] = useState('');
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState(false);

  const valider = async () => {
    if (nouveau.length < 8) {
      setErreur('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (nouveau !== confirmer) {
      setErreur('Les deux mots de passe ne correspondent pas.');
      return;
    }
    setChargement(true);
    setErreur(null);
    try {
      await changerMotDePasse(nouveau);
      setSucces(true);
    } catch (e: unknown) {
      setErreur(e instanceof Error ? e.message : 'Une erreur est survenue.');
    } finally {
      setChargement(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={s.fond}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <StatusBar barStyle="light-content" />

      {/* En-tête */}
      <View style={[s.header, { paddingTop: TOP_INSET + 12 }]}>
        <TouchableOpacity onPress={onBack} hitSlop={12} style={s.backBtn}>
          <IcoBack />
        </TouchableOpacity>
        <Text style={s.headerTitre}>Mot de passe</Text>
        <View style={{ width: 32 }} />
      </View>

      <View style={s.corps}>
        {succes ? (
          <View style={s.succesBloc}>
            <Text style={s.succesTxt}>Mot de passe modifié avec succès.</Text>
            <TouchableOpacity style={s.btn} onPress={onBack}>
              <Text style={s.btnTxt}>Retour</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Text style={s.label}>Nouveau mot de passe</Text>
            <TextInput
              style={s.input}
              value={nouveau}
              onChangeText={setNouveau}
              placeholder="8 caractères minimum"
              placeholderTextColor={r.couleur.gris}
              secureTextEntry
            />

            <Text style={[s.label, { marginTop: 16 }]}>Confirmer</Text>
            <TextInput
              style={s.input}
              value={confirmer}
              onChangeText={setConfirmer}
              placeholder="Répétez le mot de passe"
              placeholderTextColor={r.couleur.gris}
              secureTextEntry
            />

            {erreur != null && <Text style={s.erreur}>{erreur}</Text>}

            <TouchableOpacity
              style={[s.btn, chargement && s.btnDisabled]}
              onPress={valider}
              disabled={chargement}>
              {chargement
                ? <ActivityIndicator color={r.couleur.encre} />
                : <Text style={s.btnTxt}>Enregistrer</Text>}
            </TouchableOpacity>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  fond: { flex: 1, backgroundColor: r.couleur.encre },

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

  corps: { padding: r.espace.lg },

  label: {
    fontFamily: VIP_FONTS.palais.util,
    fontSize: 11,
    letterSpacing: 2,
    color: r.couleur.orClair,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: r.couleur.filetFin,
    backgroundColor: r.couleur.velours,
    color: r.couleur.ivoire,
    fontFamily: VIP_FONTS.palais.util,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  erreur: {
    fontFamily: VIP_FONTS.palais.util,
    fontSize: 13,
    color: '#E07070',
    marginTop: 12,
  },
  btn: {
    marginTop: 24,
    backgroundColor: r.couleur.orLassi,
    paddingVertical: 15,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  btnTxt: {
    fontFamily: VIP_FONTS.palais.util,
    fontSize: 14,
    color: r.couleur.encre,
    letterSpacing: 1,
  },

  succesBloc: { alignItems: 'center', paddingTop: r.espace.xl },
  succesTxt: {
    fontFamily: VIP_FONTS.palais.util,
    fontSize: 15,
    color: r.couleur.vert,
    textAlign: 'center',
    marginBottom: r.espace.lg,
  },
});
