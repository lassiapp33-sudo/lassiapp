import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Linking,
  Platform,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { colors, fonts, radius } from '../../theme';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  slug: string;
  shopName: string;
  onClose: () => void;
}

type TargetId = 'wa_contacts' | 'facebook' | 'tiktok' | 'instagram';

interface GuideStep { n: number; txt: string; }
interface Guide {
  appLabel: string;   // bouton "Ouvrir X"
  primary: string;    // deep link app
  fallback: string;   // web/store
  steps: GuideStep[];
}

// ─── Ouverture robuste (app → web) ───────────────────────────────────────────

async function openApp(primary: string, fallback: string): Promise<void> {
  try {
    await Linking.openURL(primary);
  } catch {
    try { await Linking.openURL(fallback); } catch { /* silencieux */ }
  }
}

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Page de partage LASSI guidée — remplace la feuille de partage générique.
 * Pensée pour un marchand débutant : gros boutons par réseau, lien copié
 * automatiquement, et un guide 1-2-3 pour les réseaux où il faut coller
 * (statut WhatsApp, bio TikTok, bio Instagram).
 */
export default function SharePanel({ visible, slug, shopName, onClose }: Props) {
  const url = `https://s.lassi.tech/${slug}`;
  const message = `${shopName} est sur LASSİ ! 🎉\nEntrez directement dans ma boutique et commandez ici : ${url}`;

  const [guide, setGuide] = useState<{ id: TargetId; data: Guide } | null>(null);
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async (txt: string) => {
    try { await Clipboard.setStringAsync(txt); } catch { /* silencieux */ }
  }, []);

  const handleCopyLink = useCallback(async () => {
    await copy(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [copy, url]);

  // Fermer → remet la vue liste pour la prochaine ouverture
  const close = useCallback(() => { setGuide(null); onClose(); }, [onClose]);

  // ── Actions directes (1 geste) ──────────────────────────────────────────────
  const shareWhatsAppContacts = useCallback(async () => {
    await copy(message);
    await openApp(
      `whatsapp://send?text=${encodeURIComponent(message)}`,
      `https://wa.me/?text=${encodeURIComponent(message)}`,
    );
  }, [copy, message]);

  const shareFacebook = useCallback(async () => {
    await copy(message);
    await openApp(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
    );
  }, [copy, message, url]);

  // ── Actions guidées (copie auto + ouvre l'app + étapes à l'écran) ───────────
  const openGuide = useCallback(async (id: TargetId, data: Guide, textToCopy: string) => {
    await copy(textToCopy);
    setGuide({ id, data });
  }, [copy]);

  const GUIDES: Record<'tiktok' | 'instagram', Guide> = {
    tiktok: {
      appLabel: 'Ouvrir TikTok',
      primary: 'tiktok://',
      fallback: Platform.OS === 'ios' ? 'https://apps.apple.com/app/tiktok/id835599320' : 'https://play.google.com/store/apps/details?id=com.zhiliaoapp.musically',
      steps: [
        { n: 1, txt: 'Dans TikTok, va sur ton Profil (en bas à droite).' },
        { n: 2, txt: 'Touche « Modifier le profil ».' },
        { n: 3, txt: 'Touche « Bio », fais un appui long → « Coller ».' },
        { n: 4, txt: 'Enregistre. Ton lien est dans ta bio ✅' },
      ],
    },
    instagram: {
      appLabel: 'Ouvrir Instagram',
      primary: 'instagram://',
      fallback: Platform.OS === 'ios' ? 'https://apps.apple.com/app/instagram/id389801252' : 'https://play.google.com/store/apps/details?id=com.instagram.android',
      steps: [
        { n: 1, txt: 'Dans Instagram, va sur ton Profil.' },
        { n: 2, txt: 'Touche « Modifier le profil ».' },
        { n: 3, txt: 'Touche « Site web » (ou « Bio »), appui long → « Coller ».' },
        { n: 4, txt: 'Enregistre. Ton lien est en ligne ✅' },
      ],
    },
  };

  // ── Rendu d'un gros bouton réseau ───────────────────────────────────────────
  const NetBtn = ({ bg, label, sub, onPress }: { bg: string; label: string; sub: string; onPress: () => void }) => (
    <TouchableOpacity style={[s.netBtn, { backgroundColor: bg }]} onPress={onPress} activeOpacity={0.88}>
      <View style={s.netTxtWrap}>
        <Text style={s.netLabel}>{label}</Text>
        <Text style={s.netSub}>{sub}</Text>
      </View>
      <Text style={s.netArrow}>›</Text>
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen" onRequestClose={close}>
      <View style={s.overlay}>
        <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={close} />
        <View style={s.sheet}>
          <View style={s.grabber} />

          {guide ? (
            // ── Vue GUIDE (étapes 1-2-3) ─────────────────────────────────────
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.guideScroll}>
              <TouchableOpacity style={s.backRow} onPress={() => setGuide(null)} activeOpacity={0.7}>
                <Text style={s.backTxt}>‹ Retour</Text>
              </TouchableOpacity>

              <View style={s.copiedPill}>
                <Text style={s.copiedPillTxt}>✓ Lien déjà copié — tu n’as plus qu’à coller</Text>
              </View>

              <Text style={s.guideTitle}>Suis ces étapes</Text>

              {guide.data.steps.map(st => (
                <View key={st.n} style={s.stepRow}>
                  <View style={s.stepNum}><Text style={s.stepNumTxt}>{st.n}</Text></View>
                  <Text style={s.stepTxt}>{st.txt}</Text>
                </View>
              ))}

              <TouchableOpacity
                style={s.openBtn}
                onPress={() => openApp(guide.data.primary, guide.data.fallback)}
                activeOpacity={0.9}
              >
                <Text style={s.openBtnTxt}>{guide.data.appLabel}</Text>
              </TouchableOpacity>

              <Text style={s.guideFoot}>Astuce : pour coller, fais un appui long sur le champ puis touche « Coller ».</Text>
            </ScrollView>
          ) : (
            // ── Vue LISTE (choix du réseau) ──────────────────────────────────
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.listScroll}>
              <Text style={s.title}>Partager ma boutique</Text>
              <Text style={s.subtitle}>Choisis où partager — on te guide pas à pas. 👇</Text>

              <View style={s.linkBox}>
                <Text style={s.linkTxt} numberOfLines={1}>s.lassi.tech/{slug}</Text>
              </View>

              <NetBtn
                bg="#25D366"
                label="Envoyer à mes contacts"
                sub="WhatsApp — choisis les contacts, message déjà écrit"
                onPress={shareWhatsAppContacts}
              />
              <NetBtn
                bg="#128C7E"
                label="Mettre en statut WhatsApp"
                sub="Coche « Mon statut » en haut de la liste"
                onPress={shareWhatsAppContacts}
              />
              <NetBtn
                bg="#1877F2"
                label="Publier sur Facebook"
                sub="Aperçu de ta boutique inclus"
                onPress={shareFacebook}
              />
              <NetBtn
                bg="#000000"
                label="Mettre dans ma bio TikTok"
                sub="On te guide pour coller le lien"
                onPress={() => openGuide('tiktok', GUIDES.tiktok, url)}
              />
              <NetBtn
                bg="#C13584"
                label="Mettre dans ma bio Instagram"
                sub="On te guide pour coller le lien"
                onPress={() => openGuide('instagram', GUIDES.instagram, url)}
              />

              <TouchableOpacity style={s.copyBtn} onPress={handleCopyLink} activeOpacity={0.85}>
                <Text style={s.copyBtnTxt}>{copied ? '✓ Lien copié' : 'Copier le lien'}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={s.later} onPress={close} activeOpacity={0.7}>
                <Text style={s.laterTxt}>Fermer</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderTopWidth: 1.5,
    borderColor: colors.accent,
    paddingHorizontal: 18,
    paddingBottom: 24,
    maxHeight: '88%',
  },
  grabber: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.border,
    marginTop: 10,
    marginBottom: 6,
  },
  listScroll: { paddingTop: 6, paddingBottom: 8, gap: 10 },
  guideScroll: { paddingTop: 6, paddingBottom: 8 },

  title: { color: colors.white, fontFamily: fonts.titleXL, fontSize: 19, textAlign: 'center' },
  subtitle: { color: colors.muted, fontFamily: fonts.body, fontSize: 13, textAlign: 'center', marginTop: 4, marginBottom: 6, lineHeight: 19 },

  linkBox: {
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  linkTxt: { color: colors.accent, fontFamily: fonts.title, fontSize: 13, textAlign: 'center' },

  netBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  netTxtWrap: { flex: 1 },
  netLabel: { color: '#FFFFFF', fontFamily: fonts.titleXL, fontSize: 15 },
  netSub: { color: 'rgba(255,255,255,0.85)', fontFamily: fonts.body, fontSize: 11.5, marginTop: 2 },
  netArrow: { color: '#FFFFFF', fontSize: 26, fontFamily: fonts.ui, marginLeft: 8 },

  copyBtn: {
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  copyBtnTxt: { color: colors.accent, fontFamily: fonts.titleXL, fontSize: 14 },

  later: { marginTop: 10, paddingVertical: 6, alignItems: 'center' },
  laterTxt: { color: colors.muted, fontFamily: fonts.ui, fontSize: 12, textDecorationLine: 'underline' },

  // Guide
  backRow: { paddingVertical: 4, marginBottom: 4 },
  backTxt: { color: colors.accent, fontFamily: fonts.title, fontSize: 14 },
  copiedPill: {
    backgroundColor: 'rgba(95,211,138,.15)',
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignSelf: 'center',
    marginBottom: 12,
  },
  copiedPillTxt: { color: colors.success, fontFamily: fonts.title, fontSize: 12.5, textAlign: 'center' },
  guideTitle: { color: colors.white, fontFamily: fonts.titleXL, fontSize: 17, marginBottom: 12 },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14, gap: 12 },
  stepNum: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  stepNumTxt: { color: colors.bg, fontFamily: fonts.titleXL, fontSize: 14 },
  stepTxt: { flex: 1, color: colors.white, fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
  openBtn: {
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  openBtnTxt: { color: colors.bg, fontFamily: fonts.titleXL, fontSize: 16 },
  guideFoot: { color: colors.muted, fontFamily: fonts.body, fontSize: 12, textAlign: 'center', marginTop: 12, lineHeight: 18 },
});
