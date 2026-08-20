import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts, radius } from '../../theme';

export interface ClientOption {
  id: string;
  name: string;
  initial: string;
  phone?: string;
  isExisting: boolean;
}

// ─── Icônes ──────────────────────────────────────────────────────────────────

const IcoCheck = () => (
  <Svg
    width={19}
    height={19}
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth={2.4}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Path d="M20 6 9 17l-5-5" stroke={colors.bg} />
  </Svg>
);

const IcoBack = () => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M19 12H5M12 5l-7 7 7 7" stroke={colors.white} />
  </Svg>
);

// ─── Pavé numérique ───────────────────────────────────────────────────────────

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '·000', '0', '⌫'] as const;
const BOTTOM_PAD = Platform.OS === 'ios' ? 24 : 12;

function formatDisplay(str: string): string {
  const n = parseInt(str, 10) || 0;
  return n.toLocaleString('fr-FR');
}

// ─── Composant ────────────────────────────────────────────────────────────────

type SheetView = 'main' | 'picker' | 'manual';

interface Props {
  visible: boolean;
  clients: ClientOption[];
  onSave: (option: ClientOption, amount: number) => void;
  onClose: () => void;
}

export default function AddDebtSheet({ visible, clients, onSave, onClose }: Props) {
  const [selectedId, setSelectedId] = useState(clients[0]?.id ?? '');
  const [amountStr, setAmountStr] = useState('0');
  const [view, setView] = useState<SheetView>('main');
  const [manualClient, setManualClient] = useState<ClientOption | null>(null);
  const [manualName, setManualName] = useState('');
  const [manualPhone, setManualPhone] = useState('');

  // Réinitialise quand le sheet se ferme
  useEffect(() => {
    if (!visible) {
      setAmountStr('0');
      setView('main');
      setManualName('');
      setManualPhone('');
    }
  }, [visible]);

  const selected: ClientOption | undefined =
    selectedId === '__manual__'
      ? (manualClient ?? undefined)
      : (clients.find(c => c.id === selectedId) ?? clients[0]);

  const amount = parseInt(amountStr, 10) || 0;

  // ── Pavé numérique ──────────────────────────────────────────────────────────
  const handleKey = (key: (typeof KEYS)[number]) => {
    if (key === '⌫') {
      setAmountStr(s => (s.length > 1 ? s.slice(0, -1) : '0'));
    } else if (key === '·000') {
      setAmountStr(s => (s === '0' ? '0' : s + '000'));
    } else {
      setAmountStr(s => (s === '0' ? key : s.length < 9 ? s + key : s));
    }
  };

  const handleSave = () => {
    const clientToSave = selectedId === '__manual__' ? manualClient : selected;
    if (!clientToSave || amount <= 0) return;
    onSave(clientToSave, amount);
    setAmountStr('0');
    onClose();
  };

  const handleManualConfirm = () => {
    const name = manualName.trim();
    if (!name) return;
    const client: ClientOption = {
      id: '__manual__',
      name,
      initial: name.charAt(0).toUpperCase(),
      phone: manualPhone.trim() || undefined,
      isExisting: false,
    };
    setManualClient(client);
    setSelectedId('__manual__');
    setView('main');
    setManualName('');
    setManualPhone('');
  };

  return (
    <Modal visible={visible} transparent presentationStyle="overFullScreen" animationType="slide" onRequestClose={onClose}>
      {/* Fond semi-transparent */}
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose} />

      {/* Sheet */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.sheet, { paddingBottom: BOTTOM_PAD }]}>
          {/* Poignée */}
          <View style={styles.grab} />

          {view === 'main' && (
            <>
              <Text style={styles.sheetTitle}>Nouvelle dette</Text>
              <Text style={styles.sheetSub}>Sélectionne le client et le montant. C'est tout.</Text>

              {/* Picker client */}
              <Text style={styles.label}>CLIENT</Text>
              <TouchableOpacity
                style={styles.picker}
                onPress={() => setView('picker')}
                activeOpacity={0.85}
              >
                <View style={styles.pickerAvatar}>
                  <Text style={styles.pickerAvatarTxt}>{selected?.initial ?? '?'}</Text>
                </View>
                <Text style={styles.pickerName}>{selected?.name ?? 'Choisir…'}</Text>
                <Text style={styles.pickerChevron}>⌄</Text>
              </TouchableOpacity>

              {/* Affichage montant */}
              <Text style={styles.label}>MONTANT DÛ</Text>
              <View style={styles.amountBox}>
                <Text style={styles.amountVal}>
                  {formatDisplay(amountStr)} <Text style={styles.amountF}>F</Text>
                </Text>
              </View>

              {/* Pavé numérique 3×4 */}
              <View style={styles.keypad}>
                {KEYS.map(key => (
                  <TouchableOpacity
                    key={key}
                    style={styles.key}
                    onPress={() => handleKey(key)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.keyTxt}>{key}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Bouton enregistrer */}
              <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.85}>
                <IcoCheck />
                <Text style={styles.saveTxt}>Enregistrer la dette</Text>
              </TouchableOpacity>
            </>
          )}

          {view === 'picker' && (
            <>
              <Text style={styles.sheetTitle}>Choisir le client</Text>
              <ScrollView style={styles.clientList} showsVerticalScrollIndicator={false}>
                {(() => {
                  const existing = clients.filter(c => c.isExisting);
                  const fresh = clients.filter(c => !c.isExisting);
                  return (
                    <>
                      {existing.length > 0 && (
                        <Text style={styles.sectionLabel}>DÉBITEURS EXISTANTS</Text>
                      )}
                      {existing.map(c => (
                        <TouchableOpacity
                          key={c.id}
                          style={[styles.clientRow, c.id === selectedId && styles.clientRowSel]}
                          onPress={() => { setSelectedId(c.id); setView('main'); }}
                          activeOpacity={0.8}
                        >
                          <View style={styles.clientAvatar}>
                            <Text style={styles.clientAvatarTxt}>{c.initial}</Text>
                          </View>
                          <Text style={styles.clientName}>{c.name}</Text>
                          {c.id === selectedId && <Text style={styles.clientCheck}>✓</Text>}
                        </TouchableOpacity>
                      ))}
                      {fresh.length > 0 && (
                        <Text style={[styles.sectionLabel, existing.length > 0 && { marginTop: 12 }]}>
                          MES CLIENTS
                        </Text>
                      )}
                      {fresh.map(c => (
                        <TouchableOpacity
                          key={c.id}
                          style={[styles.clientRow, c.id === selectedId && styles.clientRowSel]}
                          onPress={() => { setSelectedId(c.id); setView('main'); }}
                          activeOpacity={0.8}
                        >
                          <View style={styles.clientAvatar}>
                            <Text style={styles.clientAvatarTxt}>{c.initial}</Text>
                          </View>
                          <Text style={styles.clientName}>{c.name}</Text>
                          {c.id === selectedId && <Text style={styles.clientCheck}>✓</Text>}
                        </TouchableOpacity>
                      ))}
                      {/* Option saisie manuelle */}
                      <TouchableOpacity
                        style={[styles.clientRow, styles.manualRow]}
                        onPress={() => setView('manual')}
                        activeOpacity={0.8}
                      >
                        <View style={[styles.clientAvatar, styles.manualAvatar]}>
                          <Text style={styles.manualAvatarTxt}>+</Text>
                        </View>
                        <View>
                          <Text style={styles.clientName}>Ajouter manuellement</Text>
                          <Text style={styles.manualSub}>Saisir nom et numéro</Text>
                        </View>
                      </TouchableOpacity>
                    </>
                  );
                })()}
              </ScrollView>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setView('main')}
                activeOpacity={0.8}
              >
                <Text style={styles.cancelTxt}>Annuler</Text>
              </TouchableOpacity>
            </>
          )}

          {view === 'manual' && (
            <>
              {/* En-tête avec retour */}
              <View style={styles.manualHeader}>
                <TouchableOpacity onPress={() => setView('picker')} activeOpacity={0.7} style={styles.backBtn}>
                  <IcoBack />
                </TouchableOpacity>
                <Text style={styles.sheetTitle}>Nouveau client</Text>
              </View>
              <Text style={styles.sheetSub}>Renseigne le nom et, si tu veux, le numéro.</Text>

              <Text style={styles.label}>NOM DU CLIENT</Text>
              <TextInput
                style={styles.textField}
                placeholder="Ex : Mamadou Diop"
                placeholderTextColor={colors.muted}
                value={manualName}
                onChangeText={setManualName}
                autoFocus
                returnKeyType="next"
                autoCapitalize="words"
              />

              <Text style={[styles.label, { marginTop: 14 }]}>NUMÉRO DE TÉLÉPHONE (optionnel)</Text>
              <TextInput
                style={styles.textField}
                placeholder="Ex : 77 123 45 67"
                placeholderTextColor={colors.muted}
                value={manualPhone}
                onChangeText={setManualPhone}
                keyboardType="phone-pad"
                returnKeyType="done"
              />

              <TouchableOpacity
                style={[styles.saveBtn, { marginTop: 24, opacity: manualName.trim() ? 1 : 0.45 }]}
                onPress={handleManualConfirm}
                activeOpacity={0.85}
                disabled={!manualName.trim()}
              >
                <IcoCheck />
                <Text style={styles.saveTxt}>Valider</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(10,11,24,.65)',
  },

  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 22,
    paddingTop: 10,
  },
  grab: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: 18,
  },

  sheetTitle: {
    color: colors.white,
    fontFamily: fonts.titleXL,
    fontSize: 19,
    marginBottom: 4,
  },
  sheetSub: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12.5,
    marginBottom: 20,
  },

  label: {
    color: colors.muted,
    fontFamily: fonts.ui,
    fontSize: 12,
    marginBottom: 8,
    letterSpacing: 0.3,
  },

  // Picker client
  picker: {
    height: 52,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 11,
    marginBottom: 16,
  },
  pickerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerAvatarTxt: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 13,
  },
  pickerName: {
    flex: 1,
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 14,
  },
  pickerChevron: {
    color: colors.muted,
    fontSize: 16,
  },

  // Affichage montant
  amountBox: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 18,
  },
  amountVal: {
    color: colors.white,
    fontFamily: fonts.titleXL,
    fontSize: 32,
  },
  amountF: {
    color: colors.accent,
  },

  // Pavé numérique
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
    marginBottom: 18,
  },
  key: {
    width: '30%',
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
  },
  keyTxt: {
    color: colors.white,
    fontFamily: fonts.titleXL,
    fontSize: 18,
  },

  // Bouton sauvegarder
  saveBtn: {
    height: 54,
    borderRadius: radius.lg,
    backgroundColor: colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveTxt: {
    color: colors.bg,
    fontFamily: fonts.titleXL,
    fontSize: 16,
  },

  sectionLabel: {
    color: colors.muted,
    fontFamily: fonts.ui,
    fontSize: 10,
    letterSpacing: 0.5,
    paddingHorizontal: 4,
    paddingBottom: 4,
  },

  // Liste clients (picker ouvert)
  clientList: {
    maxHeight: 300,
    marginBottom: 12,
  },
  clientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  clientRowSel: {
    backgroundColor: 'rgba(253,207,52,.06)',
    borderRadius: 10,
  },
  clientAvatar: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clientAvatarTxt: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 15,
  },
  clientName: {
    flex: 1,
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 14,
  },
  clientCheck: {
    color: colors.accent,
    fontFamily: fonts.titleXL,
    fontSize: 16,
  },
  cancelBtn: {
    height: 46,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  cancelTxt: {
    color: colors.muted,
    fontFamily: fonts.ui,
    fontSize: 14,
  },

  // Ligne "Ajouter manuellement"
  manualRow: {
    marginTop: 4,
  },
  manualAvatar: {
    borderColor: colors.accent,
    borderStyle: 'dashed',
  },
  manualAvatarTxt: {
    color: colors.accent,
    fontFamily: fonts.titleXL,
    fontSize: 20,
  },
  manualSub: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11,
    marginTop: 1,
  },

  // Formulaire manuel
  manualHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 4,
  },
  backBtn: {
    padding: 4,
  },
  textField: {
    height: 50,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    color: colors.white,
    fontFamily: fonts.body,
    fontSize: 14,
  },
});

