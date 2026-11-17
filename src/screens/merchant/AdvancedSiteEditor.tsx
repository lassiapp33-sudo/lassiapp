import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView,
  ActivityIndicator, Platform, Alert, KeyboardAvoidingView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { uploadVideo } from '../../services/storage';
import { colors, radius, spacing, fonts, TOP_INSET } from '../../theme';
import {
  buildEditPreviewUrl, buildDraftPreviewUrl, SITE_SECTIONS, SITE_FONTS, SITE_ACCENTS, SITE_ANIMATIONS,
  TEXT_SIZES, CARD_STYLES, HERO_STYLES, COLS_OPTIONS,
  type SiteConfig, type SiteOverrides, type TextStyle,
} from '../../config/siteThemes';

interface Props {
  slug: string | null;
  cfg: SiteConfig;
  saving: boolean;
  onSave: () => void;
  onChange: (next: SiteConfig) => void;
  onBack: () => void;
}

type Tool = 'sections' | 'texte' | 'menu' | 'medias' | 'animations' | 'dispo';
const TOOLS: { id: Tool; label: string; icon: string }[] = [
  { id: 'sections',   label: 'Conteneurs', icon: '▦' },
  { id: 'texte',      label: 'Texte',      icon: 'T' },
  { id: 'menu',       label: 'Menu',       icon: '☰' },
  { id: 'medias',     label: 'Médias',     icon: '▣' },
  { id: 'animations', label: 'Animations', icon: '✦' },
  { id: 'dispo',      label: 'Disposition', icon: '⬒' },
];

// Élément de texte sélectionné dans la page (reçu par postMessage).
interface TextSel { key: string; text: string; size: number; color: string }
interface MenuItem { i: number; label: string }

export default function AdvancedSiteEditor({ slug, cfg, saving, onSave, onChange, onBack }: Props) {
  const [tool, setTool] = useState<Tool | null>(null);
  const [preview, setPreview] = useState(false);
  const [vidBusy, setVidBusy] = useState(false);
  const [selText, setSelText] = useState<TextSel | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[] | null>(null);
  // Sections réellement présentes pour cette boutique (reçu de la page via led:ready).
  const [hasSec, setHasSec] = useState<{ products: boolean; services: boolean; terrains: boolean } | null>(null);
  const webRef = useRef<WebView>(null);

  // Amène l'élément en cours d'édition bien visible dans l'aperçu (clavier ouvert).
  const scrollToKey = useCallback((key: string) => {
    const js = `window.__ledScrollTo && window.__ledScrollTo(${JSON.stringify(key)}); true;`;
    setTimeout(() => webRef.current?.injectJavaScript(js), 350);
  }, []);

  const ov: SiteOverrides = cfg.overrides ?? {};

  // URL de l'aperçu : NE DÉPEND PAS des overrides (cosmétiques poussés en live via
  // injectJavaScript). Ne recharge que sur changements structurels (layout/thème).
  const structuralKey = useMemo(
    () => JSON.stringify({ t: cfg.template, k: cfg.tokens, l: cfg.layout, n: cfg.displayName, v: cfg.heroVideo }),
    [cfg.template, cfg.tokens, cfg.layout, cfg.displayName, cfg.heroVideo],
  );
  // En mode Aperçu : URL draft SANS overlay d'édition (vue réelle client, overrides
  // appliqués). En édition : overlay actif, overrides poussés en live.
  const uri = useMemo(
    () => {
      if (!slug) return null;
      return preview
        ? buildDraftPreviewUrl(slug, cfg)
        : buildEditPreviewUrl(slug, { ...cfg, overrides: undefined });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [slug, structuralKey, preview],
  );

  // Pousse les overrides dans la page sans rechargement (application live).
  const injectLive = useCallback((next: SiteOverrides) => {
    const js = `window.__ledApply && window.__ledApply(${JSON.stringify(next)}); true;`;
    webRef.current?.injectJavaScript(js);
  }, []);

  // Aperçu : bascule entre l'édition et la vue réelle du site (comme chez le client).
  const togglePreview = useCallback(() => {
    setPreview(p => {
      if (!p) setTool(null);
      return !p;
    });
  }, []);

  // Écrit les overrides (persistance locale) + applique en live.
  const setOv = useCallback((next: SiteOverrides) => {
    const clean = Object.keys(next).length ? next : undefined;
    onChange({ ...cfg, overrides: clean });
    injectLive(next);
  }, [cfg, onChange, injectLive]);

  // Helpers d'écriture.
  const patchStyle = useCallback((key: string, p: Partial<TextStyle>) => {
    const style = { ...(ov.style ?? {}) };
    style[key] = { ...(style[key] ?? {}), ...p };
    setOv({ ...ov, style });
  }, [ov, setOv]);

  const setText = useCallback((key: string, text: string) => {
    const t = { ...(ov.text ?? {}) };
    t[key] = text;
    setOv({ ...ov, text: t });
  }, [ov, setOv]);

  const setAnim = useCallback((key: string, anim: string) => {
    const a = { ...(ov.anim ?? {}) };
    if (anim) a[key] = anim; else delete a[key];
    setOv({ ...ov, anim: a });
  }, [ov, setOv]);

  const toggleMenu = useCallback((i: number) => {
    const set = new Set(ov.menuHidden ?? []);
    if (set.has(i)) set.delete(i); else set.add(i);
    setOv({ ...ov, menuHidden: Array.from(set).sort((a, b) => a - b) });
  }, [ov, setOv]);

  const patchMenuStyle = useCallback((p: Partial<TextStyle>) => {
    setOv({ ...ov, menuStyle: { ...(ov.menuStyle ?? {}), ...p } });
  }, [ov, setOv]);

  // Vidéo de présentation : picker (durée courte + preset bas = très compressé) → upload.
  const pickVideo = useCallback(async () => {
    if (!slug || vidBusy) return;
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { Alert.alert('Permission requise', 'Autorise l\'accès à la galerie pour choisir une vidéo.'); return; }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos'],
        quality: 0,
        videoMaxDuration: 15,
        videoExportPreset: ImagePicker.VideoExportPreset.LowQuality,
        allowsEditing: true,
      });
      if (res.canceled || !res.assets?.[0]?.uri) return;
      setVidBusy(true);
      const path = `sitevideo/${encodeURIComponent(slug)}/hero_${Date.now()}.mp4`;
      const url = await uploadVideo(res.assets[0].uri, path);
      onChange({ ...cfg, heroVideo: url });
    } catch (e: any) {
      Alert.alert('Erreur', e?.message || 'Upload vidéo impossible.');
    } finally {
      setVidBusy(false);
    }
  }, [slug, vidBusy, cfg, onChange]);

  const removeVideo = useCallback(() => {
    const next = { ...cfg };
    delete next.heroVideo;
    onChange(next);
  }, [cfg, onChange]);

  const patchLayout = useCallback((p: Partial<SiteConfig['layout']>) => {
    onChange({ ...cfg, layout: { ...cfg.layout, ...p } });
  }, [cfg, onChange]);

  // Sections réellement affichées : filtre sur les conteneurs présents (si connu).
  const visibleOrder = useMemo(
    () => cfg.layout.order.filter(id => !hasSec || (hasSec as any)[id]),
    [cfg.layout.order, hasSec],
  );

  // Déplace une section (par son id) devant/derrière la section visible adjacente.
  const moveSection = useCallback((id: string, dir: -1 | 1) => {
    const vis = cfg.layout.order.filter(x => !hasSec || (hasSec as any)[x]);
    const vi = vis.indexOf(id);
    const vj = vi + dir;
    if (vi < 0 || vj < 0 || vj >= vis.length) return;
    const order = [...cfg.layout.order];
    const a = order.indexOf(vis[vi]);
    const b = order.indexOf(vis[vj]);
    [order[a], order[b]] = [order[b], order[a]];
    onChange({ ...cfg, layout: { ...cfg.layout, order } });
  }, [cfg, onChange, hasSec]);

  // Réception des messages de la page.
  const onMessage = useCallback((e: WebViewMessageEvent) => {
    let m: any;
    try { m = JSON.parse(e.nativeEvent.data); } catch { return; }
    if (!m || typeof m !== 'object') return;
    switch (m.type) {
      case 'led:text':
        setSelText({ key: String(m.key), text: String(m.text ?? ''), size: Number(m.size ?? 16), color: String(m.color ?? '') });
        setTool('texte');
        scrollToKey(String(m.key));
        break;
      case 'led:ready':
        if (m.has && typeof m.has === 'object') {
          setHasSec({ products: !!m.has.products, services: !!m.has.services, terrains: !!m.has.terrains });
        }
        break;
      case 'led:textChange':
        // Édition inline dans la page → on stocke sans réinjecter (déjà visible).
        if (m.key) {
          const t = { ...(cfg.overrides?.text ?? {}) };
          t[String(m.key)] = String(m.text ?? '');
          onChange({ ...cfg, overrides: { ...(cfg.overrides ?? {}), text: t } });
        }
        break;
      case 'led:menu':
        setMenuItems(Array.isArray(m.items) ? m.items : []);
        setTool('menu');
        break;
    }
  }, [cfg, onChange, scrollToKey]);

  const selKey = selText?.key ?? null;
  const curAnim = selKey ? (ov.anim?.[selKey] ?? '') : '';

  return (
    <View style={styles.root}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.iconBtn} onPress={onBack} activeOpacity={0.7}>
          <Text style={styles.iconTxt}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>Éditeur avancé</Text>
        <TouchableOpacity style={[styles.previewBtn, preview && styles.previewBtnOn]} onPress={togglePreview} activeOpacity={0.75}>
          <Text style={[styles.previewIc, preview && styles.previewTxtOn]}>👁</Text>
          <Text style={[styles.previewLbl, preview && styles.previewTxtOn]}>{preview ? 'Éditer' : 'Aperçu'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.saveBtn, saving && styles.saveBtnOff]} onPress={onSave} activeOpacity={0.85} disabled={saving}>
          {saving ? <ActivityIndicator color={colors.bg} size="small" /> : <Text style={styles.saveTxt}>Enregistrer</Text>}
        </TouchableOpacity>
      </View>

      <View style={[styles.canvas, preview && styles.canvasFull]}>
        {slug && uri ? (
          <WebView
            ref={webRef}
            key={uri}
            source={{ uri }}
            style={styles.webview}
            originWhitelist={['https://*']}
            scrollEnabled
            startInLoadingState
            onMessage={onMessage}
            onLoadEnd={() => { if (!preview) injectLive(cfg.overrides ?? {}); }}
            renderLoading={() => (<View style={styles.webLoading}><ActivityIndicator color={colors.accent} /></View>)}
          />
        ) : (
          <View style={styles.webLoading}><Text style={styles.noPreview}>Aperçu indisponible (lien de partage manquant).</Text></View>
        )}
      </View>

      {!preview && (
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
      {tool ? (
        <ScrollView style={styles.panel} contentContainerStyle={styles.panelIn} keyboardShouldPersistTaps="handled" keyboardDismissMode="none">
          <Text style={styles.panelTitle}>{TOOLS.find(t => t.id === tool)?.label}</Text>

          {/* ── Conteneurs : réordonner (uniquement ceux réellement présents) ── */}
          {tool === 'sections' && (
            <View style={styles.orderList}>
              <Text style={styles.hint}>Déplace les conteneurs pour changer leur ordre sur le site.</Text>
              {visibleOrder.length === 0 ? (
                <Text style={styles.hint}>Aucun conteneur à afficher pour l'instant.</Text>
              ) : visibleOrder.map((id, i) => {
                const sec = SITE_SECTIONS.find(s => s.id === id);
                if (!sec) return null;
                return (
                  <View key={id} style={styles.orderRow}>
                    <Text style={styles.orderPos}>{i + 1}</Text>
                    <Text style={styles.orderLbl}>{sec.label}</Text>
                    <TouchableOpacity disabled={i === 0} onPress={() => moveSection(id, -1)} style={[styles.sqBtn, i === 0 && styles.off]}><Text style={styles.sqTxt}>↑</Text></TouchableOpacity>
                    <TouchableOpacity disabled={i === visibleOrder.length - 1} onPress={() => moveSection(id, 1)} style={[styles.sqBtn, i === visibleOrder.length - 1 && styles.off]}><Text style={styles.sqTxt}>↓</Text></TouchableOpacity>
                  </View>
                );
              })}
            </View>
          )}

          {/* ── Texte : contenu + taille + couleur + police ── */}
          {tool === 'texte' && (selText ? (
            <View>
              <Text style={styles.hint}>Modifie le texte directement dans l'aperçu, ou ici :</Text>
              <TextInput
                style={styles.input} value={selText.text} multiline
                onFocus={() => scrollToKey(selText.key)}
                onChangeText={v => { setSelText({ ...selText, text: v }); setText(selText.key, v); }}
                placeholder="Texte" placeholderTextColor={colors.muted} maxLength={200}
              />
              <Text style={styles.lbl}>Taille</Text>
              <View style={styles.wrap}>
                {TEXT_SIZES.map(s => {
                  const on = (ov.style?.[selText.key]?.size ?? selText.size) === s;
                  return <TouchableOpacity key={s} onPress={() => patchStyle(selText.key, { size: s })} style={[styles.chip, on && styles.chipOn]}><Text style={[styles.chipTxt, on && styles.chipTxtOn]}>{s}</Text></TouchableOpacity>;
                })}
              </View>
              <Text style={styles.lbl}>Couleur</Text>
              <View style={styles.wrap}>
                {SITE_ACCENTS.map(a => {
                  const on = (ov.style?.[selText.key]?.color ?? '').toUpperCase() === a.hex.toUpperCase();
                  return <TouchableOpacity key={a.id} onPress={() => patchStyle(selText.key, { color: a.hex })} style={[styles.dot, { backgroundColor: a.hex }, on && styles.dotOn]} />;
                })}
              </View>
              <Text style={styles.lbl}>Police</Text>
              <View style={styles.wrap}>
                {SITE_FONTS.map(f => {
                  const on = ov.style?.[selText.key]?.font === f.id;
                  return <TouchableOpacity key={f.id} onPress={() => patchStyle(selText.key, { font: f.id })} style={[styles.chip, on && styles.chipOn]}><Text style={[styles.chipTxt, on && styles.chipTxtOn]}>{f.label}</Text></TouchableOpacity>;
                })}
              </View>
            </View>
          ) : <Text style={styles.hint}>Touche un texte dans l'aperçu pour l'éditer.</Text>)}

          {/* ── Menu : masquer entrées + style ── */}
          {tool === 'menu' && (menuItems ? (
            <View>
              <Text style={styles.hint}>Masque des entrées ou change leur style.</Text>
              {menuItems.map(it => {
                const hidden = (ov.menuHidden ?? []).includes(it.i);
                return (
                  <View key={it.i} style={styles.orderRow}>
                    <Text style={[styles.orderLbl, hidden && styles.strike]}>{it.label || `Entrée ${it.i + 1}`}</Text>
                    <TouchableOpacity onPress={() => toggleMenu(it.i)} style={[styles.pill, hidden && styles.pillOff]}><Text style={styles.pillTxt}>{hidden ? 'Masqué' : 'Visible'}</Text></TouchableOpacity>
                  </View>
                );
              })}
              <Text style={styles.lbl}>Couleur du menu</Text>
              <View style={styles.wrap}>
                {SITE_ACCENTS.map(a => {
                  const on = (ov.menuStyle?.color ?? '').toUpperCase() === a.hex.toUpperCase();
                  return <TouchableOpacity key={a.id} onPress={() => patchMenuStyle({ color: a.hex })} style={[styles.dot, { backgroundColor: a.hex }, on && styles.dotOn]} />;
                })}
              </View>
              <Text style={styles.lbl}>Police du menu</Text>
              <View style={styles.wrap}>
                {SITE_FONTS.map(f => {
                  const on = ov.menuStyle?.font === f.id;
                  return <TouchableOpacity key={f.id} onPress={() => patchMenuStyle({ font: f.id })} style={[styles.chip, on && styles.chipOn]}><Text style={[styles.chipTxt, on && styles.chipTxtOn]}>{f.label}</Text></TouchableOpacity>;
                })}
              </View>
            </View>
          ) : <Text style={styles.hint}>Touche le menu (barre de navigation) dans l'aperçu.</Text>)}

          {/* ── Animations : entrée du texte sélectionné ── */}
          {tool === 'animations' && (selText ? (
            <View>
              <Text style={styles.hint}>Animation d'entrée pour : <Text style={styles.hl}>{selText.text.slice(0, 30) || 'texte'}</Text></Text>
              <View style={styles.wrap}>
                {SITE_ANIMATIONS.map(a => {
                  const on = curAnim === a.id;
                  return <TouchableOpacity key={a.id || 'none'} onPress={() => setAnim(selText.key, a.id)} style={[styles.chip, on && styles.chipOn]}><Text style={[styles.chipTxt, on && styles.chipTxtOn]}>{a.label}</Text></TouchableOpacity>;
                })}
              </View>
            </View>
          ) : <Text style={styles.hint}>Touche d'abord un texte dans l'aperçu, puis choisis son animation.</Text>)}

          {/* ── Médias ── */}
          {tool === 'medias' && (
            <View>
              <Text style={styles.hint}>Les images proviennent de ta galerie et de tes produits (app). Ajoute/retire-les depuis « Ma galerie » et tes fiches produits — elles apparaissent automatiquement ici.</Text>
              <Text style={styles.lbl}>Vidéo de présentation (template Maroquinerie)</Text>
              <Text style={styles.hint}>Courte (max 15 s), compressée automatiquement. Lecture au clic sur le bouton ▶ de l'en-tête.</Text>
              <View style={styles.wrap}>
                <TouchableOpacity onPress={pickVideo} disabled={vidBusy} style={[styles.pill, vidBusy && styles.off]}>
                  {vidBusy ? <ActivityIndicator color={colors.bg} size="small" /> : <Text style={styles.pillTxt}>{cfg.heroVideo ? 'Remplacer la vidéo' : 'Ajouter une vidéo'}</Text>}
                </TouchableOpacity>
                {cfg.heroVideo ? (
                  <TouchableOpacity onPress={removeVideo} style={[styles.pill, styles.pillOff]}>
                    <Text style={[styles.pillTxt, { color: colors.white }]}>Retirer</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              {cfg.heroVideo ? <Text style={[styles.hint, { color: colors.accent, marginTop: 8 }]}>✓ Vidéo ajoutée</Text> : null}
            </View>
          )}

          {/* ── Disposition : colonnes / cartes / en-tête ── */}
          {tool === 'dispo' && (
            <View>
              <Text style={styles.lbl}>Colonnes de produits</Text>
              <View style={styles.wrap}>
                {COLS_OPTIONS.map(n => {
                  const on = cfg.layout.cols === n;
                  return <TouchableOpacity key={n} onPress={() => patchLayout({ cols: n })} style={[styles.chip, on && styles.chipOn]}><Text style={[styles.chipTxt, on && styles.chipTxtOn]}>{n} col.</Text></TouchableOpacity>;
                })}
              </View>
              <Text style={styles.lbl}>Style des cartes</Text>
              <View style={styles.wrap}>
                {CARD_STYLES.map(cs => {
                  const on = cfg.layout.card === cs.id;
                  return <TouchableOpacity key={cs.id} onPress={() => patchLayout({ card: cs.id })} style={[styles.chip, on && styles.chipOn]}><Text style={[styles.chipTxt, on && styles.chipTxtOn]}>{cs.label}</Text></TouchableOpacity>;
                })}
              </View>
              <Text style={styles.lbl}>En-tête</Text>
              <View style={styles.wrap}>
                {HERO_STYLES.map(hs => {
                  const on = cfg.layout.hero === hs.id;
                  return <TouchableOpacity key={hs.id} onPress={() => patchLayout({ hero: hs.id })} style={[styles.chip, on && styles.chipOn]}><Text style={[styles.chipTxt, on && styles.chipTxtOn]}>{hs.label}</Text></TouchableOpacity>;
                })}
              </View>
            </View>
          )}
        </ScrollView>
      ) : null}

      <View style={styles.toolbar}>
        {TOOLS.map(t => {
          const on = tool === t.id;
          return (
            <TouchableOpacity key={t.id} style={styles.toolBtn} activeOpacity={0.75} onPress={() => setTool(on ? null : t.id)}>
              <Text style={[styles.toolIcon, on && styles.toolIconOn]}>{t.icon}</Text>
              <Text style={[styles.toolLbl, on && styles.toolLblOn]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      </KeyboardAvoidingView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingTop: TOP_INSET + 6, paddingHorizontal: spacing.screen, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  iconBtn: { width: 38, height: 38, borderRadius: radius.pill, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  iconTxt: { color: colors.white, fontSize: 26, lineHeight: 28, marginTop: -2 },
  title: { flex: 1, color: colors.white, fontFamily: fonts.title, fontSize: 14 },
  previewBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.accent, paddingHorizontal: 12, paddingVertical: 7, marginRight: 8 },
  previewBtnOn: { backgroundColor: colors.accent },
  previewIc: { fontSize: 13 },
  previewLbl: { color: colors.accent, fontFamily: fonts.label, fontSize: 12.5 },
  previewTxtOn: { color: colors.bg },
  saveBtn: { backgroundColor: colors.accent, borderRadius: radius.pill, paddingHorizontal: 13, paddingVertical: 7, alignItems: 'center' },
  saveBtnOff: { opacity: 0.6 },
  saveTxt: { color: colors.bg, fontFamily: fonts.title, fontSize: 12.5 },

  canvas: { flex: 1, backgroundColor: '#fff', margin: spacing.screen, borderRadius: radius.xl, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  canvasFull: { margin: 0, borderRadius: 0, borderWidth: 0 },
  webview: { flex: 1, backgroundColor: '#fff' },
  webLoading: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  noPreview: { color: '#888', fontSize: 13, textAlign: 'center', paddingHorizontal: 20 },

  panel: { maxHeight: 260, marginHorizontal: spacing.screen, marginBottom: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg },
  panelIn: { padding: 14 },
  panelTitle: { color: colors.white, fontFamily: fonts.title, fontSize: 15, marginBottom: 8 },
  hint: { color: colors.muted, fontFamily: fonts.body, fontSize: 11.5, lineHeight: 16, marginBottom: 8 },
  hl: { color: colors.accent, fontFamily: fonts.title },
  lbl: { color: colors.white, fontFamily: fonts.ui, fontSize: 12.5, marginTop: 12, marginBottom: 6 },
  input: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: Platform.OS === 'ios' ? 10 : 7, color: colors.white, fontFamily: fonts.body, fontSize: 14, minHeight: 40 },

  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { backgroundColor: colors.bg, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 13, paddingVertical: 7 },
  chipOn: { borderColor: colors.accent },
  chipTxt: { color: colors.muted, fontFamily: fonts.label, fontSize: 11.5 },
  chipTxtOn: { color: colors.white },
  dot: { width: 34, height: 34, borderRadius: radius.pill, borderWidth: 2, borderColor: 'transparent' },
  dotOn: { borderColor: colors.white },

  orderList: { gap: 7 },
  orderRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingVertical: 8, paddingHorizontal: 12, marginBottom: 7 },
  orderPos: { color: colors.accent, fontFamily: fonts.title, fontSize: 13, width: 20 },
  orderLbl: { flex: 1, color: colors.white, fontFamily: fonts.ui, fontSize: 13.5 },
  strike: { textDecorationLine: 'line-through', color: colors.muted },
  sqBtn: { width: 34, height: 34, borderRadius: radius.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  off: { opacity: 0.35 },
  sqTxt: { color: colors.white, fontSize: 16, lineHeight: 18 },
  pill: { backgroundColor: colors.accent, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6 },
  pillOff: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border },
  pillTxt: { color: colors.bg, fontFamily: fonts.label, fontSize: 11 },

  toolbar: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.screen, paddingTop: 8, paddingBottom: Platform.OS === 'ios' ? 28 : 14, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.bg },
  toolBtn: { alignItems: 'center', flex: 1 },
  toolIcon: { color: colors.muted, fontSize: 20, marginBottom: 3 },
  toolIconOn: { color: colors.accent },
  toolLbl: { color: colors.muted, fontFamily: fonts.label, fontSize: 10 },
  toolLblOn: { color: colors.white },
});
