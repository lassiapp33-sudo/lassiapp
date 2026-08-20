import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { royal as r } from '../theme';
import { VIP_FONTS } from '../useVipFonts';
import { JOURS_SEMAINE, VipHoraire } from '../../types/vip';
import { getMonHoraires, getMonProfilVip, upsertHoraire } from '../../services/vip';
import { TOP_INSET } from '../../theme';

const IcoBack = () => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none"
    stroke={r.couleur.or} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M15 18l-6-6 6-6" />
  </Svg>
);

// Ordre d'affichage : lundi (1) → samedi (6) → dimanche (0)
const ORDRE_AFFICHAGE: (0 | 1 | 2 | 3 | 4 | 5 | 6)[] = [1, 2, 3, 4, 5, 6, 0];

interface LigneHoraire {
  jour: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  ferme: boolean;
  ouverture: string;
  fermeture: string;
  note: string;
}

function heureFmt(h: VipHoraire): LigneHoraire {
  return {
    jour: h.jour,
    ferme: h.ferme,
    ouverture: h.ouverture ?? '',
    fermeture: h.fermeture ?? '',
    note: h.note ?? '',
  };
}

function horaireVide(jour: 0 | 1 | 2 | 3 | 4 | 5 | 6): LigneHoraire {
  return { jour, ferme: false, ouverture: '', fermeture: '', note: '' };
}

const formatHeure = (raw: string): string => {
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return digits.slice(0, 2) + ':' + digits.slice(2);
};

interface Props {
  onBack: () => void;
}

export default function GerantHorairesScreen({ onBack }: Props) {
  const [lignes, setLignes] = useState<LigneHoraire[]>(
    ORDRE_AFFICHAGE.map(horaireVide),
  );
  const [profilId, setProfilId] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);
  const [sauvegarde, setSauvegarde] = useState(false);

  const charger = useCallback(async () => {
    setChargement(true);
    const [profil, horaires] = await Promise.all([getMonProfilVip(), getMonHoraires()]);
    if (profil) setProfilId(profil.id);
    const map = new Map<number, VipHoraire>(horaires.map(h => [h.jour, h]));
    setLignes(ORDRE_AFFICHAGE.map(j => {
      const h = map.get(j);
      return h ? heureFmt(h) : horaireVide(j);
    }));
    setChargement(false);
  }, []);

  useEffect(() => { charger(); }, [charger]);

  const maj = (jour: number, champ: Partial<LigneHoraire>) => {
    setLignes(l => l.map(x => x.jour === jour ? { ...x, ...champ } : x));
  };

  const enregistrer = async () => {
    if (!profilId) return;
    // Validation légère des formats HH:MM
    const invalides = lignes.filter(l => {
      if (l.ferme) return false;
      const re = /^([01]\d|2[0-3]):[0-5]\d$/;
      return (l.ouverture && !re.test(l.ouverture)) || (l.fermeture && !re.test(l.fermeture));
    });
    if (invalides.length > 0) {
      Alert.alert('Format incorrect', 'Utilise le format HH:MM (ex: 08:30).');
      return;
    }
    setSauvegarde(true);
    try {
      await Promise.all(lignes.map(l =>
        upsertHoraire({
          vipProfilId: profilId,
          jour: l.jour,
          ferme: l.ferme,
          ouverture: l.ferme ? undefined : (l.ouverture || undefined),
          fermeture: l.ferme ? undefined : (l.fermeture || undefined),
          note: l.note || undefined,
        })
      ));
      Alert.alert('Horaires enregistrés', 'Vos horaires ont été mis à jour.');
    } catch {
      Alert.alert('Erreur', 'Impossible d\'enregistrer les horaires.');
    } finally {
      setSauvegarde(false);
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
        <Text style={s.headerTitre}>Mes heures</Text>
        <View style={{ width: 32 }} />
      </View>

      {chargement ? (
        <View style={s.centre}>
          <ActivityIndicator color={r.couleur.or} />
        </View>
      ) : (
        <ScrollView keyboardShouldPersistTaps="handled">
          {/* Légende colonnes */}
          <View style={s.legende}>
            <Text style={[s.legendeTxt, { flex: 1 }]}>Jour</Text>
            <Text style={[s.legendeTxt, { width: 70, textAlign: 'center' }]}>Ouvert</Text>
            <Text style={[s.legendeTxt, { width: 72, textAlign: 'center' }]}>Ouvre</Text>
            <Text style={[s.legendeTxt, { width: 72, textAlign: 'center' }]}>Ferme</Text>
          </View>

          {lignes.map(l => (
            <View key={l.jour} style={s.ligne}>
              <Text style={s.jourTxt}>{JOURS_SEMAINE[l.jour]}</Text>
              <Switch
                value={!l.ferme}
                onValueChange={v => maj(l.jour, { ferme: !v })}
                thumbColor={!l.ferme ? r.couleur.or : r.couleur.gris}
                trackColor={{ false: r.couleur.velours, true: 'rgba(201,162,39,0.4)' }}
                style={{ width: 50, marginHorizontal: 10 }}
              />
              <TextInput
                style={[s.heureInput, l.ferme && s.inputDisabled]}
                value={l.ouverture}
                onChangeText={v => maj(l.jour, { ouverture: formatHeure(v) })}
                placeholder="08:00"
                placeholderTextColor={r.couleur.gris}
                editable={!l.ferme}
                keyboardType="number-pad"
                maxLength={5}
              />
              <TextInput
                style={[s.heureInput, l.ferme && s.inputDisabled]}
                value={l.fermeture}
                onChangeText={v => maj(l.jour, { fermeture: formatHeure(v) })}
                placeholder="22:00"
                placeholderTextColor={r.couleur.gris}
                editable={!l.ferme}
                keyboardType="number-pad"
                maxLength={5}
              />
            </View>
          ))}

          <TouchableOpacity
            style={[s.btnSave, sauvegarde && s.btnDisabled]}
            onPress={enregistrer}
            disabled={sauvegarde}>
            {sauvegarde
              ? <ActivityIndicator color={r.couleur.encre} />
              : <Text style={s.btnSaveTxt}>Enregistrer</Text>}
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  fond:   { flex: 1, backgroundColor: r.couleur.encre },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },

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

  legende: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: r.espace.md,
    paddingTop: 14,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: r.couleur.filetFin,
  },
  legendeTxt: {
    fontFamily: VIP_FONTS.palais.util,
    fontSize: 10,
    letterSpacing: 1.5,
    color: r.couleur.gris,
    textTransform: 'uppercase',
  },

  ligne: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: r.espace.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: r.couleur.filetFin,
  },
  jourTxt: {
    fontFamily: VIP_FONTS.palais.util,
    fontSize: 13,
    color: r.couleur.ivoire,
    flex: 1,
  },
  heureInput: {
    width: 62,
    borderWidth: 1,
    borderColor: r.couleur.filetFin,
    backgroundColor: r.couleur.velours,
    color: r.couleur.ivoire,
    fontFamily: VIP_FONTS.palais.util,
    fontSize: 13,
    paddingHorizontal: 8,
    paddingVertical: 7,
    textAlign: 'center',
    marginLeft: 4,
  },
  inputDisabled: { opacity: 0.3 },

  btnSave: {
    marginHorizontal: r.espace.md,
    marginTop: r.espace.lg,
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
});
