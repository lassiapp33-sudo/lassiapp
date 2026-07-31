import React, { useState } from 'react';
import {
  ActivityIndicator,
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
import { royal as r } from '../theme';
import { VIP_FONTS } from '../useVipFonts';
import { Blason } from '../composants/Blason';
import { connexionVip } from '../authVip';
import { getMonProfilVip } from '../../services/vip';
import useGerantStore from '../../store/gerantStore';
import { TOP_INSET } from '../../theme';

interface Props {
  onSuccess: () => void;
}

export default function GerantLoginScreen({ onSuccess }: Props) {
  const [telephone, setTelephone] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const setGerant = useGerantStore(s => s.setGerant);

  const seConnecter = async () => {
    if (!telephone.trim() || !motDePasse) {
      setErreur('Numéro et mot de passe requis.');
      return;
    }
    setChargement(true);
    setErreur(null);
    try {
      await connexionVip(telephone.trim(), motDePasse);
      const profil = await getMonProfilVip();
      if (!profil) {
        setErreur('Profil 5 Étoiles introuvable. Contacte l\'administrateur.');
        return;
      }
      setGerant(profil);
      onSuccess();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Identifiants incorrects.';
      setErreur(msg.includes('Invalid login') ? 'Numéro ou mot de passe incorrect.' : msg);
    } finally {
      setChargement(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={s.fond}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <StatusBar barStyle="light-content" backgroundColor={r.couleur.encre} />
      <ScrollView
        contentContainerStyle={[s.scroll, { paddingTop: TOP_INSET + 20 }]}
        keyboardShouldPersistTaps="handled">

        {/* Blason + titre */}
        <View style={s.entete}>
          <Blason initiale="V" taille={72} />
          <Text style={s.titre}>Espace gérant</Text>
          <Text style={s.sous}>5 Étoiles LASSI</Text>
        </View>

        {/* Formulaire */}
        <View style={s.form}>
          <Text style={s.label}>Numéro de téléphone</Text>
          <TextInput
            style={s.input}
            value={telephone}
            onChangeText={setTelephone}
            placeholder="7X XXX XX XX"
            placeholderTextColor={r.couleur.gris}
            keyboardType="phone-pad"
            autoCorrect={false}
          />

          <Text style={[s.label, { marginTop: 16 }]}>Mot de passe</Text>
          <TextInput
            style={s.input}
            value={motDePasse}
            onChangeText={setMotDePasse}
            placeholder="••••••••"
            placeholderTextColor={r.couleur.gris}
            secureTextEntry
          />

          {erreur != null && (
            <Text style={s.erreur}>{erreur}</Text>
          )}

          <TouchableOpacity
            style={[s.btn, chargement && s.btnDisabled]}
            onPress={seConnecter}
            disabled={chargement}>
            {chargement
              ? <ActivityIndicator color={r.couleur.encre} />
              : <Text style={s.btnTxt}>Se connecter</Text>}
          </TouchableOpacity>
        </View>

        <Text style={s.note}>
          Accès réservé aux gérants 5 Étoiles LASSI.{'\n'}
          Identifiants fournis par l'administrateur.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  fond:  { flex: 1, backgroundColor: r.couleur.encre },
  scroll: { paddingHorizontal: 28, paddingBottom: 40 },

  entete: { alignItems: 'center', marginBottom: 36 },
  titre: {
    fontFamily: VIP_FONTS.palais.titre,
    fontSize: 24,
    color: r.couleur.ivoire,
    letterSpacing: 2,
    marginTop: 18,
  },
  sous: {
    fontFamily: VIP_FONTS.palais.util,
    fontSize: 11,
    letterSpacing: 3,
    color: r.couleur.or,
    textTransform: 'uppercase',
    marginTop: 6,
  },

  form: {
    borderWidth: 1,
    borderColor: r.couleur.filet,
    padding: 22,
    marginBottom: 24,
  },
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
    marginTop: 22,
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

  note: {
    fontFamily: VIP_FONTS.palais.util,
    fontSize: 12,
    color: r.couleur.gris,
    textAlign: 'center',
    lineHeight: 20,
  },
});
