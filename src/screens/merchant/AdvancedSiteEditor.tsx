import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform,
} from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { colors, radius, spacing, fonts, TOP_INSET } from '../../theme';
import { buildEditPreviewUrl, SITE_SECTIONS, type SiteConfig } from '../../config/siteThemes';

interface Props {
  slug: string | null;
  cfg: SiteConfig;
  saving: boolean;
  onSave: () => void;
  onChange: (next: SiteConfig) => void;
  onBack: () => void;
}

// Outils de l'éditeur avancé (façon Wix). Les panneaux sont branchés tâche par tâche.
type Tool = 'sections' | 'texte' | 'menu' | 'medias' | 'animations' | 'dispo';
const TOOLS: { id: Tool; label: string; icon: string }[] = [
  { id: 'sections',   label: 'Conteneurs', icon: '▦' },
  { id: 'texte',      label: 'Texte',      icon: 'T' },
  { id: 'menu',       label: 'Menu',       icon: '☰' },
  { id: 'medias',     label: 'Médias',     icon: '▣' },
  { id: 'animations', label: 'Animations', icon: '✦' },
  { id: 'dispo',      label: 'Disposition', icon: '⬒' },
];

/**
 * Éditeur avancé du site — espace plein écran où le prestataire a le contrôle
 * total (déplacer conteneurs, textes, menu, médias, animations) de façon simple.
 * Scaffold (Task 1) : aperçu plein écran + barre d'outils. Les panneaux arrivent
 * tâche par tâche (mode édition web `?edit=1`, bridge postMessage, etc.).
 */
// Bloc sélectionné dans la page (reçu par postMessage depuis l'overlay web).
interface Selection { id: string; tag: string; label: string; y: number }

export default function AdvancedSiteEditor({ slug, cfg, saving, onSave, onChange, onBack }: Props) {
  const [tool, setTool] = useState<Tool | null>(null);
  const [sel, setSel] = useState<Selection | null>(null);
  const uri = useMemo(() => (slug ? buildEditPreviewUrl(slug, cfg) : null), [slug, cfg]);

  // Réordonne un conteneur (déplacement haut/bas), applique en live (recharge draft).
  const moveSection = useCallback((idx: number, dir: -1 | 1) => {
    const order = [...cfg.layout.order];
    const j = idx + dir;
    if (j < 0 || j >= order.length) return;
    [order[idx], order[j]] = [order[j], order[idx]];
    onChange({ ...cfg, layout: { ...cfg.layout, order } });
  }, [cfg, onChange]);

  // Réception des messages de l'overlay d'édition (sélection d'un conteneur).
  const onMessage = useCallback((e: WebViewMessageEvent) => {
    let m: any;
    try { m = JSON.parse(e.nativeEvent.data); } catch { return; }
    if (!m || typeof m !== 'object') return;
    if (m.type === 'led:select') {
      const s: Selection = { id: String(m.id ?? ''), tag: String(m.tag ?? ''), label: String(m.label ?? ''), y: Number(m.y ?? 0) };
      setSel(s);
      // Ouvre automatiquement le panneau pertinent selon le bloc touché.
      setTool(s.tag === 'nav' ? 'menu' : 'sections');
    }
  }, []);

  return (
    <View style={styles.root}>
      {/* Barre haute : retour + titre + enregistrer */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.iconBtn} onPress={onBack} activeOpacity={0.7}>
          <Text style={styles.iconTxt}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>Éditeur avancé</Text>
        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnOff]}
          onPress={onSave}
          activeOpacity={0.85}
          disabled={saving}
        >
          {saving ? <ActivityIndicator color={colors.bg} size="small" /> : <Text style={styles.saveTxt}>Enregistrer</Text>}
        </TouchableOpacity>
      </View>

      {/* Canevas : aperçu plein écran du site réel */}
      <View style={styles.canvas}>
        {slug && uri ? (
          <WebView
            key={uri}
            source={{ uri }}
            style={styles.webview}
            originWhitelist={['https://*']}
            scrollEnabled
            startInLoadingState
            onMessage={onMessage}
            renderLoading={() => (
              <View style={styles.webLoading}><ActivityIndicator color={colors.accent} /></View>
            )}
          />
        ) : (
          <View style={styles.webLoading}>
            <Text style={styles.noPreview}>Aperçu indisponible (lien de partage manquant).</Text>
          </View>
        )}
      </View>

      {/* Panneau d'outil actif (placeholder tant que la tâche dédiée n'est pas faite) */}
      {tool ? (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>{TOOLS.find(t => t.id === tool)?.label}</Text>
          {sel ? (
            <Text style={styles.panelSel}>Bloc sélectionné : <Text style={styles.panelSelHl}>{sel.label || sel.tag}</Text></Text>
          ) : null}

          {tool === 'sections' ? (
            /* Réordonner les conteneurs de contenu (produits / prestations / terrains) */
            <View style={styles.orderList}>
              <Text style={styles.panelHint}>Déplace les conteneurs pour changer leur ordre sur le site.</Text>
              {cfg.layout.order.map((id, i) => {
                const sec = SITE_SECTIONS.find(s => s.id === id);
                if (!sec) return null;
                return (
                  <View key={id} style={styles.orderRow}>
                    <Text style={styles.orderPos}>{i + 1}</Text>
                    <Text style={styles.orderLbl}>{sec.label}</Text>
                    <TouchableOpacity disabled={i === 0} onPress={() => moveSection(i, -1)}
                      style={[styles.moveBtn, i === 0 && styles.moveBtnOff]} activeOpacity={0.7}>
                      <Text style={styles.moveTxt}>↑</Text>
                    </TouchableOpacity>
                    <TouchableOpacity disabled={i === cfg.layout.order.length - 1} onPress={() => moveSection(i, 1)}
                      style={[styles.moveBtn, i === cfg.layout.order.length - 1 && styles.moveBtnOff]} activeOpacity={0.7}>
                      <Text style={styles.moveTxt}>↓</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          ) : (
            <Text style={styles.panelSoon}>Touche un conteneur dans l'aperçu pour le sélectionner. Les réglages de cet outil arrivent dans les prochaines étapes.</Text>
          )}
        </View>
      ) : null}

      {/* Barre d'outils */}
      <View style={styles.toolbar}>
        {TOOLS.map(t => {
          const on = tool === t.id;
          return (
            <TouchableOpacity
              key={t.id}
              style={styles.toolBtn}
              activeOpacity={0.75}
              onPress={() => setTool(on ? null : t.id)}
            >
              <Text style={[styles.toolIcon, on && styles.toolIconOn]}>{t.icon}</Text>
              <Text style={[styles.toolLbl, on && styles.toolLblOn]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingTop: TOP_INSET + 6, paddingHorizontal: spacing.screen, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  iconBtn: { width: 38, height: 38, borderRadius: radius.pill, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  iconTxt: { color: colors.white, fontSize: 26, lineHeight: 28, marginTop: -2 },
  title: { flex: 1, color: colors.white, fontFamily: fonts.title, fontSize: 18 },
  saveBtn: { backgroundColor: colors.accent, borderRadius: radius.pill, paddingHorizontal: 18, paddingVertical: 9, minWidth: 96, alignItems: 'center' },
  saveBtnOff: { opacity: 0.6 },
  saveTxt: { color: colors.bg, fontFamily: fonts.title, fontSize: 14 },

  canvas: { flex: 1, backgroundColor: '#fff', margin: spacing.screen, borderRadius: radius.xl, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  webview: { flex: 1, backgroundColor: '#fff' },
  webLoading: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  noPreview: { color: '#888', fontSize: 13, textAlign: 'center', paddingHorizontal: 20 },

  panel: { marginHorizontal: spacing.screen, marginBottom: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 16 },
  panelTitle: { color: colors.white, fontFamily: fonts.title, fontSize: 15, marginBottom: 6 },
  panelSel: { color: colors.white, fontFamily: fonts.body, fontSize: 12.5, marginBottom: 6 },
  panelSelHl: { color: colors.accent, fontFamily: fonts.title },
  panelSoon: { color: colors.muted, fontFamily: fonts.body, fontSize: 12.5, lineHeight: 17 },
  panelHint: { color: colors.muted, fontFamily: fonts.body, fontSize: 11.5, marginBottom: 8, lineHeight: 15 },
  orderList: { gap: 7, marginTop: 2 },
  orderRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingVertical: 8, paddingHorizontal: 12 },
  orderPos: { color: colors.accent, fontFamily: fonts.title, fontSize: 13, width: 20 },
  orderLbl: { flex: 1, color: colors.white, fontFamily: fonts.ui, fontSize: 13.5 },
  moveBtn: { width: 34, height: 34, borderRadius: radius.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  moveBtnOff: { opacity: 0.35 },
  moveTxt: { color: colors.white, fontSize: 16, lineHeight: 18 },

  toolbar: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.screen, paddingTop: 8, paddingBottom: Platform.OS === 'ios' ? 28 : 14, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.bg },
  toolBtn: { alignItems: 'center', flex: 1 },
  toolIcon: { color: colors.muted, fontSize: 20, marginBottom: 3 },
  toolIconOn: { color: colors.accent },
  toolLbl: { color: colors.muted, fontFamily: fonts.label, fontSize: 10 },
  toolLblOn: { color: colors.white },
});
