import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  Switch,
  ActivityIndicator,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { colors, fonts, radius } from '../../theme';
import useShopStore from '../../store/shopStore';
import {
  loadKeyboardPrefs,
  saveKeyboardPrefs,
  openKeyboardSettings,
  setSwitchNotification,
  isSwitchNotificationOn,
  type KeyboardPrefs,
} from '../../services/keyboardSync';

// Palette de fonds proposée (couleurs, pas d'image en V1 pour éviter les
// permissions média bloquées par la politique Google Play).
const BG_SWATCHES = ['#14152A', '#1E2040', '#128C7E', '#25D366', '#1877F2', '#000000', '#FDCF34'];

interface Props {
  onBack: () => void;
}

export default function KeyboardBoosterScreen({ onBack }: Props) {
  const shopId = useShopStore(s => s.shopId);
  const shopName = useShopStore(s => s.profile?.name ?? 'Ma Boutique');
  const slug = useShopStore(s => s.profile?.slug ?? null);
  const vitrineUrl = slug ? `https://s.lassi.tech/${slug}` : null;

  const [prefs, setPrefs] = useState<KeyboardPrefs | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [notifOn, setNotifOn] = useState(false);

  useEffect(() => {
    if (shopId) loadKeyboardPrefs(shopId, shopName).then(setPrefs);
    isSwitchNotificationOn().then(setNotifOn);
  }, [shopId, shopName]);

  const toggleNotif = useCallback(async (value: boolean) => {
    setNotifOn(value);
    await setSwitchNotification(value);
  }, []);

  const copyLink = useCallback(async () => {
    if (!vitrineUrl) return;
    try { await Clipboard.setStringAsync(vitrineUrl); } catch { /* */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [vitrineUrl]);

  const updateReply = useCallback((id: string, text: string) => {
    setPrefs(p => p && ({ ...p, quickReplies: p.quickReplies.map(r => r.id === id ? { ...r, text } : r) }));
  }, []);

  const pickBg = useCallback((value: string) => {
    setPrefs(p => p && ({ ...p, background: { type: 'color', value } }));
  }, []);

  const save = useCallback(async () => {
    if (!shopId || !prefs) return;
    setSaving(true);
    try { await saveKeyboardPrefs(shopId, shopName, slug, prefs); } finally { setSaving(false); }
  }, [shopId, shopName, slug, prefs]);

  return (
    <View style={s.root}>
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={s.back}>‹ Retour</Text>
        </TouchableOpacity>
        <Text style={s.hTitle}>Clavier Vendeur</Text>
        <View style={{ width: 54 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={s.lead}>
          Ton clavier LASSI met ton lien de vitrine et tes réponses de vente à portée de doigt,
          dans WhatsApp et partout ailleurs. 🚀
        </Text>

        {/* Activation */}
        <View style={s.card}>
          <Text style={s.step}>1. Active le clavier LASSI</Text>
          <Text style={s.hint}>Ouvre les réglages → active « Clavier LASSI » dans la liste des claviers.</Text>
          <TouchableOpacity style={s.primaryBtn} onPress={async () => { await openKeyboardSettings(); }} activeOpacity={0.9}>
            <Text style={s.primaryTxt}>Activer mon clavier</Text>
          </TouchableOpacity>

          <Text style={[s.step, { marginTop: 16 }]}>2. Passe sur le clavier LASSI</Text>
          <Text style={s.hint}>
            {Platform.OS === 'android'
              ? 'Dans WhatsApp, touche 🌐 (globe) en bas du clavier pour basculer sur LASSI.'
              : 'Dans WhatsApp, appui long sur 🌐 (globe) pour choisir le clavier LASSI.'}
          </Text>
        </View>

        {/* Notification de bascule rapide (Android) */}
        {Platform.OS === 'android' && (
          <View style={s.card}>
            <View style={s.notifRow}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={s.step}>Bascule rapide (1 tap)</Text>
                <Text style={s.hint}>
                  Affiche une notification discrète. Pendant que tu postes ton statut, baisse le volet
                  et touche « Basculer sur LASSI ».
                </Text>
              </View>
              <Switch
                value={notifOn}
                onValueChange={toggleNotif}
                trackColor={{ false: colors.border, true: colors.accent }}
                thumbColor={colors.white}
              />
            </View>
          </View>
        )}

        {/* Lien vitrine */}
        <View style={s.card}>
          <Text style={s.step}>Mon lien vitrine</Text>
          <View style={s.linkBox}><Text style={s.linkTxt} numberOfLines={1}>{slug ? `s.lassi.tech/${slug}` : 'Vitrine pas encore prête'}</Text></View>
          <TouchableOpacity style={s.ghostBtn} onPress={copyLink} disabled={!vitrineUrl} activeOpacity={0.85}>
            <Text style={s.ghostTxt}>{copied ? '✓ Lien copié' : 'Copier le lien'}</Text>
          </TouchableOpacity>
        </View>

        {/* Réponses rapides */}
        <View style={s.card}>
          <Text style={s.step}>Mes réponses rapides</Text>
          <Text style={s.hint}>Elles apparaissent sur ton clavier. Touche une réponse = elle s’écrit toute seule. « {'{lien}'} » devient ton lien vitrine.</Text>
          {!prefs ? (
            <ActivityIndicator color={colors.accent} style={{ marginTop: 12 }} />
          ) : (
            prefs.quickReplies.map(r => (
              <View key={r.id} style={s.replyRow}>
                <Text style={s.replyLabel}>{r.label}</Text>
                <TextInput
                  style={s.replyInput}
                  value={r.text}
                  onChangeText={t => updateReply(r.id, t)}
                  multiline
                  placeholder="Texte de la réponse"
                  placeholderTextColor={colors.muted}
                />
              </View>
            ))
          )}
        </View>

        {/* Fond du clavier */}
        <View style={s.card}>
          <Text style={s.step}>Couleur de mon clavier</Text>
          <View style={s.swatchRow}>
            {BG_SWATCHES.map(c => {
              const active = prefs?.background?.type === 'color' && prefs.background.value === c;
              return (
                <TouchableOpacity
                  key={c}
                  style={[s.swatch, { backgroundColor: c }, active && s.swatchActive]}
                  onPress={() => pickBg(c)}
                />
              );
            })}
          </View>
        </View>

        <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving || !prefs} activeOpacity={0.9}>
          {saving ? <ActivityIndicator color={colors.bg} /> : <Text style={s.saveTxt}>Enregistrer mon clavier</Text>}
        </TouchableOpacity>
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 52, paddingBottom: 12 },
  back: { color: colors.accent, fontFamily: fonts.title, fontSize: 15, width: 54 },
  hTitle: { color: colors.white, fontFamily: fonts.titleXL, fontSize: 18 },
  scroll: { paddingHorizontal: 16, paddingTop: 4 },
  lead: { color: colors.muted, fontFamily: fonts.body, fontSize: 13.5, lineHeight: 20, marginBottom: 14 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg ?? 16, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 14 },
  pill: { alignSelf: 'flex-start', borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 10 },
  pillTxt: { color: colors.white, fontFamily: fonts.title, fontSize: 12.5 },
  step: { color: colors.white, fontFamily: fonts.titleXL, fontSize: 15 },
  hint: { color: colors.muted, fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18, marginTop: 4, marginBottom: 10 },
  primaryBtn: { height: 50, borderRadius: radius.md, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  primaryTxt: { color: colors.bg, fontFamily: fonts.titleXL, fontSize: 15 },
  ghostBtn: { height: 46, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.accent, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  ghostTxt: { color: colors.accent, fontFamily: fonts.titleXL, fontSize: 14 },
  refresh: { alignSelf: 'center', marginTop: 12, paddingVertical: 4 },
  refreshTxt: { color: colors.muted, fontFamily: fonts.ui, fontSize: 12, textDecorationLine: 'underline' },
  notifRow: { flexDirection: 'row', alignItems: 'center' },
  linkBox: { backgroundColor: colors.bg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 11, marginTop: 8 },
  linkTxt: { color: colors.accent, fontFamily: fonts.title, fontSize: 13, textAlign: 'center' },
  replyRow: { marginTop: 12 },
  replyLabel: { color: colors.white, fontFamily: fonts.title, fontSize: 13, marginBottom: 5 },
  replyInput: { backgroundColor: colors.bg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, color: colors.white, fontFamily: fonts.body, fontSize: 13.5, paddingHorizontal: 12, paddingVertical: 10, minHeight: 44, textAlignVertical: 'top' },
  swatchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 },
  swatch: { width: 40, height: 40, borderRadius: 10, borderWidth: 2, borderColor: 'transparent' },
  swatchActive: { borderColor: colors.white },
  saveBtn: { height: 52, borderRadius: radius.md, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  saveTxt: { color: colors.bg, fontFamily: fonts.titleXL, fontSize: 16 },
});
