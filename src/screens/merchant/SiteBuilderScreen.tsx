import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, Platform, Modal,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { colors, radius, spacing, fonts, TOP_INSET } from '../../theme';
import useShopStore from '../../store/shopStore';
import {
  SITE_PALETTES, SITE_ACCENTS, SITE_FONTS, SITE_TEMPLATES,
  DEFAULT_SITE_CONFIG, buildDraftPreviewUrl, buildDemoPreviewUrl, applyTemplate,
  type SiteConfig,
} from '../../config/siteThemes';
import { getSiteConfig, saveSiteConfig } from '../../services/siteBuilder';
import AdvancedSiteEditor from './AdvancedSiteEditor';

interface Props { onBack: () => void }

// Polices visibles : 3 premières + la police sélectionnée (si hors des 3). Repliable.
function visibleFonts(selectedId: string, expanded: boolean) {
  if (expanded) return SITE_FONTS;
  const first = SITE_FONTS.slice(0, 3);
  if (first.some(f => f.id === selectedId)) return first;
  const sel = SITE_FONTS.find(f => f.id === selectedId);
  return sel ? [...first, sel] : first;
}

type View3 = 'menu' | 'editor' | 'templates' | 'advanced';

// Phrase de présentation par template (affichée dans la galerie).
const TEMPLATE_PITCH: Record<string, string> = {
  classic:   'Épuré et polyvalent. Convient à toutes les boutiques.',
  cosmetic:  'Chaleureux et féminin. Idéal beauté, cosmétique, soins.',
  pottery:   'Artisanal et brut. Parfait pour le fait-main et la déco.',
  furniture: 'Élégant et posé. Pensé pour la maison et le mobilier.',
  garderobe: 'Mode et urbain. Idéal prêt-à-porter et accessoires.',
  sac: 'Épuré et robuste. Pensé pour sacs, maroquinerie et bagagerie.',
};

export default function SiteBuilderScreen({ onBack }: Props) {
  const shopId = useShopStore(s => s.shopId);
  const slug = useShopStore(s => s.profile.slug);
  const shopName = useShopStore(s => s.profile.name);

  const [view, setView] = useState<View3>('menu');
  const [cfg, setCfg] = useState<SiteConfig>(DEFAULT_SITE_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Galerie templates : id du template dont on regarde l'aperçu.
  const [tplPreview, setTplPreview] = useState<string | null>(null);
  const [applyingTpl, setApplyingTpl] = useState(false);

  // Polices : afficher 3 puis déplier le reste via « Voir plus ».
  const [showAllHeadFonts, setShowAllHeadFonts] = useState(false);
  const [showAllBodyFonts, setShowAllBodyFonts] = useState(false);

  // Charge la config existante.
  useEffect(() => {
    if (!shopId) { setLoading(false); return; }
    getSiteConfig(shopId)
      .then(setCfg)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [shopId]);

  // Aperçu live éditeur : reconstruit l'URL draft (debounce pour la saisie du nom).
  useEffect(() => {
    if (!slug) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPreviewUri(buildDraftPreviewUrl(slug, cfg));
    }, 450);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [slug, cfg]);

  const patchSocial = useCallback((p: Partial<NonNullable<SiteConfig['social']>>) => {
    setCfg(c => ({ ...c, social: { facebook: '', tiktok: '', instagram: '', ...c.social, ...p } }));
  }, []);
  const patchTokens = useCallback((p: Partial<SiteConfig['tokens']>) => {
    setCfg(c => ({ ...c, tokens: { ...c.tokens, ...p } }));
  }, []);


  const onSave = useCallback(async () => {
    if (!shopId) return;
    setSaving(true);
    const res = await saveSiteConfig(shopId, cfg);
    setSaving(false);
    if (res.success) Alert.alert('Enregistré', 'Ton site web est à jour.');
    else Alert.alert('Erreur', res.error);
  }, [shopId, cfg]);

  const onReset = useCallback(() => {
    Alert.alert('Réinitialiser', 'Revenir au design par défaut ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Réinitialiser', style: 'destructive', onPress: () => setCfg(DEFAULT_SITE_CONFIG) },
    ]);
  }, []);

  // Applique un template choisi dans la galerie, enregistre, puis revient au menu.
  const chooseTemplate = useCallback(async (templateId: string) => {
    if (!shopId) return;
    const next = applyTemplate(cfg, templateId);
    setApplyingTpl(true);
    const res = await saveSiteConfig(shopId, next);
    setApplyingTpl(false);
    if (res.success) {
      setCfg(next);
      setTplPreview(null);
      setView('menu');
      Alert.alert('Template appliqué', 'Ton site utilise maintenant ce design. Tu peux l\'ajuster dans « Configurer mon site ».');
    } else {
      Alert.alert('Erreur', res.error);
    }
  }, [shopId, cfg]);

  const goBack = useCallback(() => {
    if (view === 'menu') { onBack(); return; }
    if (view === 'advanced') { setView('editor'); return; }
    setTplPreview(null);
    setView('menu');
  }, [view, onBack]);

  const title = view === 'editor' ? ''
    : view === 'templates' ? 'Choisir un template'
    : 'Mon site web';

  // Éditeur avancé : écran plein (barre haute + outils propres).
  if (view === 'advanced') {
    return (
      <AdvancedSiteEditor
        slug={slug ?? null}
        cfg={cfg}
        saving={saving}
        onSave={onSave}
        onChange={setCfg}
        onBack={() => setView('editor')}
      />
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={goBack} activeOpacity={0.7}>
          <Text style={styles.backTxt}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.pageTitle}>{title}</Text>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.accent} /></View>
      ) : view === 'menu' ? (
        /* ───────────────────────── MENU : 2 options ───────────────────────── */
        <View style={styles.menuWrap}>
          <Text style={styles.menuIntro}>
            Gère l'apparence de ta vitrine en ligne {slug ? `s.lassi.tech/${slug}` : ''}.
          </Text>

          <TouchableOpacity style={styles.menuCard} activeOpacity={0.85} onPress={() => setView('editor')}>
            <View style={styles.menuCardTxt}>
              <Text style={styles.menuCardTitle}>Configurer mon site actuel</Text>
              <Text style={styles.menuCardDesc}>Modifie couleurs, polices, nom, réseaux sociaux et agencement des sections.</Text>
            </View>
            <Text style={styles.menuChevron}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuCard} activeOpacity={0.85} onPress={() => setView('templates')}>
            <View style={styles.menuCardTxt}>
              <Text style={styles.menuCardTitle}>Choisir un template</Text>
              <Text style={styles.menuCardDesc}>Parcours les designs prêts-à-l'emploi, regarde l'aperçu et applique celui qui te plaît.</Text>
            </View>
            <Text style={styles.menuChevron}>›</Text>
          </TouchableOpacity>
        </View>

      ) : view === 'templates' ? (
        /* ─────────────────────── GALERIE DE TEMPLATES ─────────────────────── */
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 140 }}>
          <Text style={styles.galleryIntro}>
            Touche un template pour voir en plein écran un exemple de site avec ce design, puis applique-le.
          </Text>

          {SITE_TEMPLATES.map(tp => {
            const active = cfg.template === tp.id;
            return (
              <TouchableOpacity
                key={tp.id}
                style={[styles.tplHeader, active && styles.tplHeaderOpen]}
                activeOpacity={0.85}
                onPress={() => setTplPreview(tp.id)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.tplName}>{tp.label}</Text>
                  <Text style={styles.tplPitch}>{TEMPLATE_PITCH[tp.id] ?? 'Design prêt-à-l\'emploi.'}</Text>
                </View>
                {active ? <Text style={styles.tplActiveBadge}>Actuel</Text> : null}
                <Text style={styles.tplChevron}>▸</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

      ) : (
        /* ───────────────────────── ÉDITEUR COMPLET ───────────────────────── */
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          keyboardDismissMode="interactive">
          {/* Accès éditeur avancé (contrôle total façon Wix) */}
          <TouchableOpacity style={styles.advBtn} activeOpacity={0.85} onPress={() => setView('advanced')}>
            <Text style={styles.advBtnIcon}>⚙️</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.advBtnTitle}>Configuration avancée du site</Text>
              <Text style={styles.advBtnDesc}>Déplace les conteneurs, édite les textes, le menu, les médias et les animations.</Text>
            </View>
            <Text style={styles.advBtnChevron}>›</Text>
          </TouchableOpacity>

          {/* Aperçu live */}
          <View style={styles.previewWrap}>
            {slug && previewUri ? (
              <WebView
                key={previewUri}
                source={{ uri: previewUri }}
                style={styles.webview}
                originWhitelist={['https://*']}
                scrollEnabled
                startInLoadingState
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
          <Text style={styles.previewHint}>
            Aperçu en direct de ton site {slug ? `s.lassi.tech/${slug}` : ''}. Tes produits et prix ne changent pas.
          </Text>

          {/* Nom affiché */}
          <Text style={styles.secLbl}>Nom affiché sur le site</Text>
          <TextInput
            style={styles.input}
            placeholder={shopName || 'Nom de ta boutique'}
            placeholderTextColor={colors.muted}
            value={cfg.displayName ?? ''}
            onChangeText={v => setCfg(c => ({ ...c, displayName: v }))}
            maxLength={60}
          />
          <Text style={styles.fieldHint}>Laisse vide pour garder « {shopName} ».</Text>

          {/* Réseaux sociaux */}
          <Text style={styles.secLbl}>Réseaux sociaux</Text>
          <Text style={styles.fieldHint}>Colle le lien de tes pages. Ils apparaîtront en bas du site, cliquables. Laisse vide pour masquer.</Text>
          <TextInput
            style={styles.input}
            placeholder="https://facebook.com/ta-page"
            placeholderTextColor={colors.muted}
            autoCapitalize="none" keyboardType="url"
            value={cfg.social?.facebook ?? ''}
            onChangeText={v => patchSocial({ facebook: v })}
            maxLength={300}
          />
          <TextInput
            style={styles.input}
            placeholder="https://tiktok.com/@ton-compte"
            placeholderTextColor={colors.muted}
            autoCapitalize="none" keyboardType="url"
            value={cfg.social?.tiktok ?? ''}
            onChangeText={v => patchSocial({ tiktok: v })}
            maxLength={300}
          />
          <TextInput
            style={styles.input}
            placeholder="https://instagram.com/ton-compte"
            placeholderTextColor={colors.muted}
            autoCapitalize="none" keyboardType="url"
            value={cfg.social?.instagram ?? ''}
            onChangeText={v => patchSocial({ instagram: v })}
            maxLength={300}
          />

          {/* Palette */}
          <Text style={styles.secLbl}>Palette de couleurs</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rowScroll}>
            {SITE_PALETTES.filter(p => !p.hidden || cfg.tokens.palette === p.id).map(p => {
              const on = cfg.tokens.palette === p.id;
              return (
                <TouchableOpacity key={p.id} activeOpacity={0.8} onPress={() => patchTokens({ palette: p.id })}
                  style={[styles.paletteChip, on && styles.chipOn]}>
                  <View style={styles.swatchRow}>
                    <View style={[styles.swatch, { backgroundColor: p.bg }]} />
                    <View style={[styles.swatch, { backgroundColor: p.text }]} />
                    <View style={[styles.swatch, { backgroundColor: p.soft }]} />
                  </View>
                  <Text style={[styles.chipLbl, on && styles.chipLblOn]}>{p.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Accent */}
          <Text style={styles.secLbl}>Couleur d'accent</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rowScroll}>
            {SITE_ACCENTS.map(a => {
              const on = cfg.tokens.accent.toUpperCase() === a.hex.toUpperCase();
              return (
                <TouchableOpacity key={a.id} activeOpacity={0.8} onPress={() => patchTokens({ accent: a.hex })}
                  style={[styles.accentDot, { backgroundColor: a.hex }, on && styles.accentDotOn]}>
                  {on ? <Text style={styles.accentCheck}>✓</Text> : null}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Police titres */}
          <Text style={styles.secLbl}>Police des titres</Text>
          <View style={styles.wrapChips}>
            {visibleFonts(cfg.tokens.fontHeading, showAllHeadFonts).map(f => {
              const on = cfg.tokens.fontHeading === f.id;
              return (
                <TouchableOpacity key={f.id} activeOpacity={0.8} onPress={() => patchTokens({ fontHeading: f.id })}
                  style={[styles.fontChip, on && styles.chipOn]}>
                  <Text style={[styles.chipLbl, on && styles.chipLblOn]}>{f.label}</Text>
                </TouchableOpacity>
              );
            })}
            {SITE_FONTS.length > 3 && (
              <TouchableOpacity activeOpacity={0.8} onPress={() => setShowAllHeadFonts(v => !v)} style={styles.moreChip}>
                <Text style={styles.moreChipTxt}>{showAllHeadFonts ? 'Voir moins' : 'Voir plus'}</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Police texte */}
          <Text style={styles.secLbl}>Police du texte</Text>
          <View style={styles.wrapChips}>
            {visibleFonts(cfg.tokens.fontBody, showAllBodyFonts).map(f => {
              const on = cfg.tokens.fontBody === f.id;
              return (
                <TouchableOpacity key={f.id} activeOpacity={0.8} onPress={() => patchTokens({ fontBody: f.id })}
                  style={[styles.fontChip, on && styles.chipOn]}>
                  <Text style={[styles.chipLbl, on && styles.chipLblOn]}>{f.label}</Text>
                </TouchableOpacity>
              );
            })}
            {SITE_FONTS.length > 3 && (
              <TouchableOpacity activeOpacity={0.8} onPress={() => setShowAllBodyFonts(v => !v)} style={styles.moreChip}>
                <Text style={styles.moreChipTxt}>{showAllBodyFonts ? 'Voir moins' : 'Voir plus'}</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Agencement des sections, colonnes, cartes et en-tête : déplacés dans
              l'Éditeur avancé uniquement (bouton « Personnaliser davantage »). */}

          <TouchableOpacity style={styles.resetBtn} onPress={onReset} activeOpacity={0.8}>
            <Text style={styles.resetTxt}>Réinitialiser au design par défaut</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* Barre d'enregistrement (éditeur uniquement) */}
      {!loading && view === 'editor' && (
        <View style={styles.saveBar}>
          <TouchableOpacity style={styles.saveBtn} onPress={onSave} activeOpacity={0.85} disabled={saving}>
            {saving ? <ActivityIndicator color={colors.bg} /> : <Text style={styles.saveTxt}>Enregistrer</Text>}
          </TouchableOpacity>
        </View>
      )}

      {/* Aperçu PLEIN ÉCRAN d'un template (exemple de site réel) */}
      <Modal visible={!!tplPreview} animationType="slide" onRequestClose={() => setTplPreview(null)}>
        <View style={styles.modalRoot}>
          <View style={styles.modalBar}>
            <Text style={styles.modalTitle} numberOfLines={1}>
              {SITE_TEMPLATES.find(t => t.id === tplPreview)?.label ?? 'Aperçu'}
            </Text>
            <TouchableOpacity style={styles.modalClose} onPress={() => setTplPreview(null)} activeOpacity={0.7}>
              <Text style={styles.modalCloseTxt}>✕</Text>
            </TouchableOpacity>
          </View>
          {tplPreview ? (
            <WebView
              key={`demo-${tplPreview}`}
              source={{ uri: buildDemoPreviewUrl(tplPreview) }}
              style={{ flex: 1, backgroundColor: '#fff' }}
              originWhitelist={['https://*']}
              scrollEnabled
              startInLoadingState
              renderLoading={() => (
                <View style={styles.webLoading}><ActivityIndicator color={colors.accent} /></View>
              )}
            />
          ) : null}
          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[styles.tplChooseBtn, cfg.template === tplPreview && styles.tplChooseBtnActive]}
              activeOpacity={0.85}
              disabled={applyingTpl || cfg.template === tplPreview}
              onPress={() => tplPreview && chooseTemplate(tplPreview)}
            >
              {applyingTpl
                ? <ActivityIndicator color={colors.bg} />
                : <Text style={styles.tplChooseTxt}>{cfg.template === tplPreview ? 'Template déjà appliqué' : 'Choisir ce template'}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingTop: TOP_INSET + 6, paddingHorizontal: spacing.screen, paddingBottom: 10 },
  backBtn: { width: 38, height: 38, borderRadius: radius.pill, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  backTxt: { color: colors.white, fontSize: 26, lineHeight: 28, marginTop: -2 },
  pageTitle: { color: colors.white, fontFamily: fonts.title, fontSize: 20 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Menu
  menuWrap: { paddingHorizontal: spacing.screen, paddingTop: 10 },
  menuIntro: { color: colors.muted, fontSize: 13, fontFamily: fonts.body, marginBottom: 22, lineHeight: 19 },
  menuCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, padding: 18, marginBottom: 14 },
  menuCardTxt: { flex: 1 },
  menuCardTitle: { color: colors.white, fontFamily: fonts.title, fontSize: 16, marginBottom: 4 },
  menuCardDesc: { color: colors.muted, fontFamily: fonts.body, fontSize: 12.5, lineHeight: 17 },
  menuChevron: { color: colors.accent, fontSize: 28, marginLeft: 8 },

  // Galerie templates
  galleryIntro: { color: colors.muted, fontSize: 13, fontFamily: fonts.body, marginHorizontal: spacing.screen, marginTop: 6, marginBottom: 16, lineHeight: 19 },
  tplBlock: { marginHorizontal: spacing.screen, marginBottom: 16 },
  tplHeader: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.lg, padding: 16, marginHorizontal: spacing.screen, marginBottom: 12 },
  tplHeaderOpen: { borderColor: colors.accent },
  modalRoot: { flex: 1, backgroundColor: colors.bg },
  modalBar: { flexDirection: 'row', alignItems: 'center', paddingTop: TOP_INSET + 6, paddingHorizontal: spacing.screen, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalTitle: { flex: 1, color: colors.white, fontFamily: fonts.title, fontSize: 18 },
  modalClose: { width: 38, height: 38, borderRadius: radius.pill, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  modalCloseTxt: { color: colors.white, fontSize: 18 },
  modalFooter: { padding: spacing.screen, paddingBottom: spacing.screen + 8, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.bg },
  tplName: { color: colors.white, fontFamily: fonts.title, fontSize: 17 },
  tplPitch: { color: colors.muted, fontFamily: fonts.body, fontSize: 12.5, marginTop: 4, lineHeight: 17 },
  tplActiveBadge: { color: colors.bg, backgroundColor: colors.accent, fontFamily: fonts.label, fontSize: 11, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, overflow: 'hidden', marginRight: 10 },
  tplChevron: { color: colors.accent, fontSize: 16 },
  tplPreviewArea: { height: 440, borderLeftWidth: 1.5, borderRightWidth: 1.5, borderColor: colors.accent, overflow: 'hidden', backgroundColor: '#fff' },
  tplChooseBtn: { backgroundColor: colors.accent, borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg, paddingVertical: 15, alignItems: 'center' },
  tplChooseBtnActive: { backgroundColor: colors.surface, borderWidth: 1.5, borderTopWidth: 0, borderColor: colors.accent },
  tplChooseTxt: { color: colors.bg, fontFamily: fonts.title, fontSize: 15 },

  advBtn: { flexDirection: 'row', alignItems: 'center', marginHorizontal: spacing.screen, marginTop: 6, marginBottom: 16, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.accent, borderRadius: radius.lg, padding: 16 },
  advBtnIcon: { fontSize: 22, marginRight: 12 },
  advBtnTitle: { color: colors.white, fontFamily: fonts.title, fontSize: 15, marginBottom: 3 },
  advBtnDesc: { color: colors.muted, fontFamily: fonts.body, fontSize: 12, lineHeight: 16 },
  advBtnChevron: { color: colors.accent, fontSize: 26, marginLeft: 8 },

  previewWrap: { height: 420, marginHorizontal: spacing.screen, borderRadius: radius.xl, overflow: 'hidden', backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border },
  webview: { flex: 1, backgroundColor: '#fff' },
  webLoading: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  noPreview: { color: '#888', fontSize: 13, textAlign: 'center', paddingHorizontal: 20 },
  previewHint: { color: colors.muted, fontSize: 12, fontFamily: fonts.body, marginHorizontal: spacing.screen, marginTop: 8, lineHeight: 17 },

  secLbl: { color: colors.white, fontFamily: fonts.ui, fontSize: 14, marginHorizontal: spacing.screen, marginTop: 24, marginBottom: 10 },
  input: { marginHorizontal: spacing.screen, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 13 : 10, color: colors.white, fontFamily: fonts.body, fontSize: 15 },
  fieldHint: { color: colors.muted, fontSize: 11.5, fontFamily: fonts.body, marginHorizontal: spacing.screen, marginTop: 6 },

  rowScroll: { paddingHorizontal: spacing.screen, gap: 10 },
  paletteChip: { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, padding: 10, alignItems: 'center', width: 96 },
  swatchRow: { flexDirection: 'row', gap: 4, marginBottom: 8 },
  swatch: { width: 18, height: 26, borderRadius: 5, borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)' },
  chipOn: { borderColor: colors.accent, backgroundColor: colors.surface },
  chipLbl: { color: colors.muted, fontFamily: fonts.label, fontSize: 12 },
  chipLblOn: { color: colors.white },

  accentDot: { width: 44, height: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  accentDotOn: { borderColor: colors.white },
  accentCheck: { color: '#fff', fontSize: 18, fontWeight: '800', textShadowColor: 'rgba(0,0,0,0.3)', textShadowRadius: 2 },

  wrapChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: spacing.screen },
  fontChip: { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: 10 },
  moreChip: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.accent, borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: 10 },
  moreChipTxt: { color: colors.accent, fontFamily: fonts.label, fontSize: 12 },

  orderList: { marginHorizontal: spacing.screen, gap: 8 },
  orderRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingVertical: 10, paddingHorizontal: 14 },
  orderPos: { color: colors.accent, fontFamily: fonts.title, fontSize: 14, width: 22 },
  orderLbl: { flex: 1, color: colors.white, fontFamily: fonts.ui, fontSize: 14 },
  moveBtn: { width: 36, height: 36, borderRadius: radius.sm, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  moveBtnOff: { opacity: 0.35 },
  moveTxt: { color: colors.white, fontSize: 18, lineHeight: 20 },

  resetBtn: { marginTop: 30, marginHorizontal: spacing.screen, paddingVertical: 14, alignItems: 'center' },
  resetTxt: { color: colors.danger, fontFamily: fonts.ui, fontSize: 14 },

  saveBar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.screen, paddingTop: 12, paddingBottom: Platform.OS === 'ios' ? 30 : 16, backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.border },
  saveBtn: { backgroundColor: colors.accent, borderRadius: radius.lg, paddingVertical: 16, alignItems: 'center' },
  saveTxt: { color: colors.bg, fontFamily: fonts.title, fontSize: 16 },
});
