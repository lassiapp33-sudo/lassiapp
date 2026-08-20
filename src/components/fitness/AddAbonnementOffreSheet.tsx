import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { colors, fonts, radius } from '../../theme';
import { FitnessOffre } from '../../services/fitnessAbonnements';
import { formatPrice } from '../../utils/format';
import { calculerPrixClient } from '../../config/payment';

interface Props {
  visible: boolean;
  offre: FitnessOffre | null;   // null = création, objet = édition
  onSave: (data: { nom: string; description: string; prix: number; dureeJours: number }) => Promise<void>;
  onDelete?: () => void;
  onClose: () => void;
}

const PRESETS = [2, 7, 15, 30, 60, 90];

function labelDuree(j: number): string {
  if (j === 2)  return '48 heures';
  if (j === 7)  return 'hebdomadaire';
  if (j === 15) return 'bi-mensuel';
  if (j === 30) return 'mensuel';
  if (j === 60) return 'bimestriel';
  if (j === 90) return 'trimestriel';
  if (j === 365) return 'annuel';
  return `${j} jours`;
}

export default function AddAbonnementOffreSheet({ visible, offre, onSave, onDelete, onClose }: Props) {
  const [nom,           setNom]           = useState('');
  const [description,   setDescription]   = useState('');
  const [prixStr,       setPrixStr]       = useState('');
  const [dureeJours,    setDureeJours]    = useState(30);
  const [dureeCustom,   setDureeCustom]   = useState('');
  const [customMode,    setCustomMode]    = useState(false);
  const [saving,        setSaving]        = useState(false);

  useEffect(() => {
    if (visible && offre) {
      setNom(offre.nom);
      setDescription(offre.description ?? '');
      setPrixStr(String(offre.prix));
      const preset = PRESETS.includes(offre.dureeJours);
      setDureeJours(offre.dureeJours);
      setCustomMode(!preset);
      setDureeCustom(preset ? '' : String(offre.dureeJours));
    } else if (visible) {
      setNom('');
      setDescription('');
      setPrixStr('');
      setDureeJours(30);
      setDureeCustom('');
      setCustomMode(false);
    }
  }, [visible, offre]);

  const prix = parseInt(prixStr, 10) || 0;
  const prixClient = prix > 0 ? calculerPrixClient(prix) : 0;

  const dureeFinale = customMode ? (parseInt(dureeCustom, 10) || 0) : dureeJours;

  const handleSave = async () => {
    if (!nom.trim())       return Alert.alert('Champ manquant', 'Le nom est obligatoire.');
    if (prix <= 0)         return Alert.alert('Prix invalide', 'Le prix doit être supérieur à 0.');
    if (dureeFinale <= 0)  return Alert.alert('Durée invalide', 'La durée doit être supérieure à 0.');

    setSaving(true);
    try {
      await onSave({ nom: nom.trim(), description: description.trim(), prix, dureeJours: dureeFinale });
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue';
      Alert.alert('Erreur', msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('Supprimer cette offre ?', 'Cette action est irréversible.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: onDelete },
    ]);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            {/* Poignée */}
            <View style={styles.handle} />

            <ScrollView
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.title}>
                {offre ? "Modifier l'abonnement" : 'Nouvel abonnement'}
              </Text>

              {/* Nom */}
              <Text style={styles.label}>Nom de l'abonnement *</Text>
              <TextInput
                style={styles.input}
                value={nom}
                onChangeText={setNom}
                placeholder="Ex : Abonnement mensuel, Abonnement premium…"
                placeholderTextColor={colors.muted}
                maxLength={100}
                returnKeyType="next"
              />

              {/* Description */}
              <Text style={[styles.label, { marginTop: 14 }]}>Description (optionnel)</Text>
              <TextInput
                style={[styles.input, styles.inputMulti]}
                value={description}
                onChangeText={setDescription}
                placeholder="Ex : Accès illimité 7j/7, salle équipée…"
                placeholderTextColor={colors.muted}
                multiline
                numberOfLines={3}
                maxLength={500}
              />

              {/* Prix */}
              <Text style={[styles.label, { marginTop: 14 }]}>Prix vendeur (FCFA) *</Text>
              <TextInput
                style={styles.input}
                value={prixStr}
                onChangeText={text => setPrixStr(text.replace(/[^0-9]/g, ''))}
                placeholder="Ex : 15000"
                placeholderTextColor={colors.muted}
                keyboardType="number-pad"
                returnKeyType="done"
              />
              {prixClient > 0 && (
                <Text style={styles.hint}>
                  Prix affiché au client : {formatPrice(prixClient)} (+ 1% LASSI)
                </Text>
              )}

              {/* Durée — sélecteur */}
              <Text style={[styles.label, { marginTop: 18 }]}>Durée de l'abonnement *</Text>
              <View style={styles.dureeChips}>
                {PRESETS.map(j => (
                  <TouchableOpacity
                    key={j}
                    style={[styles.chip, !customMode && dureeJours === j && styles.chipActive]}
                    onPress={() => { setDureeJours(j); setCustomMode(false); }}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.chipTxt, !customMode && dureeJours === j && styles.chipTxtActive]}>
                      {j === 2 ? '48h' : `${j}j`}
                    </Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={[styles.chip, customMode && styles.chipActive]}
                  onPress={() => setCustomMode(true)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.chipTxt, customMode && styles.chipTxtActive]}>Autre</Text>
                </TouchableOpacity>
              </View>
              {customMode && (
                <TextInput
                  style={[styles.input, { marginTop: 8 }]}
                  value={dureeCustom}
                  onChangeText={t => setDureeCustom(t.replace(/[^0-9]/g, ''))}
                  placeholder="Nombre de jours (ex : 45)"
                  placeholderTextColor={colors.muted}
                  keyboardType="number-pad"
                  returnKeyType="done"
                />
              )}
              {dureeFinale > 0 && (
                <Text style={styles.hint}>
                  {dureeFinale === 2 ? 'Durée : 48 heures' : `Durée : ${dureeFinale} jours (${labelDuree(dureeFinale)})`}
                </Text>
              )}

              {/* Bouton sauvegarder */}
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleSave}
                disabled={saving}
                activeOpacity={0.85}
              >
                {saving
                  ? <ActivityIndicator color={colors.bg} size="small" />
                  : <Text style={styles.saveTxt}>
                      {offre ? 'Enregistrer les modifications' : "Créer l'abonnement"}
                    </Text>
                }
              </TouchableOpacity>

              {/* Supprimer */}
              {offre && onDelete && (
                <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete} activeOpacity={0.8}>
                  <Text style={styles.deleteTxt}>Supprimer cette offre</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity onPress={onClose} style={styles.cancelBtn} activeOpacity={0.7}>
                <Text style={styles.cancelTxt}>Annuler</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  content: { padding: 22, paddingBottom: 40 },
  title: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 17,
    marginBottom: 20,
  },
  label: {
    color: colors.muted,
    fontFamily: fonts.ui,
    fontSize: 11,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.white,
    fontFamily: fonts.body,
    fontSize: 14,
  },
  inputMulti: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  hint: {
    color: colors.accent,
    fontFamily: fonts.body,
    fontSize: 12,
    marginTop: 5,
  },
  dureeChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 2,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  chipActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
  chipTxt: {
    color: colors.muted,
    fontFamily: fonts.title,
    fontSize: 13,
  },
  chipTxtActive: {
    color: colors.bg,
  },
  saveBtn: {
    marginTop: 22,
    height: 50,
    borderRadius: 14,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveTxt: {
    color: colors.bg,
    fontFamily: fonts.title,
    fontSize: 15,
  },
  deleteBtn: {
    marginTop: 12,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(224,122,122,.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteTxt: {
    color: colors.danger,
    fontFamily: fonts.title,
    fontSize: 14,
  },
  cancelBtn: {
    marginTop: 10,
    alignItems: 'center',
    paddingVertical: 10,
  },
  cancelTxt: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 14,
  },
});

