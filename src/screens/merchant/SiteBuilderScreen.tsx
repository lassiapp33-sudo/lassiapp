import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, Platform,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { colors, radius, spacing, fonts, TOP_INSET } from '../../theme';
import useShopStore from '../../store/shopStore';
import {
  SITE_PALETTES, SITE_ACCENTS, SITE_FONTS, SITE_TEMPLATES,
  SITE_SECTIONS, CARD_STYLES, HERO_STYLES, COLS_OPTIONS,
  DEFAULT_SITE_CONFIG, buildDraftPreviewUrl, applyTemplate,
  type SiteConfig, type SiteLayout,
} from '../../config/siteThemes';
import { getSiteConfig, saveSiteConfig } from '../../services/siteBuilder';

interface Props { onBack: () => void }

export default function SiteBuilderScreen({ onBack }: Props) {
  const shopId = useShopStore(s => s.shopId);
  const slug = useShopStore(s => s.profile.slug);
  const shopName = useShopStore(s => s.profile.name);

  const [cfg, setCfg] = useState<SiteConfig>(DEFAULT_SITE_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Charge la config existante.
  useEffect(() => {
    if (!shopId) { setLoading(false); return; }
    getSiteConfig(shopId)
      .then(setCfg)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [shopId]);

  // Aperçu live : reconstruit l'URL draft (debounce pour la saisie du nom).
  useEffect(() => {
    if (!slug) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPreviewUri(buildDraftPreviewUrl(slug, cfg));
    }, 450);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [slug, cfg]);

  const patchTokens = useCallback((p: Partial<SiteConfig['tokens']>) => {
    setCfg(c => ({ ...c, tokens: { ...c.tokens, ...p } }));
  }, []);

  const patchLayout = useCallback((p: Partial<SiteLayout>) => {
    setCfg(c => ({ ...c, layout: { ...c.layout, ...p } }));
  }, []);

  const moveSection = useCallback((idx: number, dir: -1 | 1) => {
    setCfg(c => {
      const order = [...c.layout.order];
      const j = idx + dir;
      if (j < 0 || j >= order.length) return c;
      [order[idx], order[j]] = [order[j], order[idx]];
      return { ...c, layout: { ...c.layout, order } };
    });
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

  return (
    <View style={styles.root}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
          <Text style={styles.backTxt}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.pageTitle}>Mon site web</Text>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.accent} /></View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
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

          {/* Template — choix principal : applique un design complet (couleurs + polices + agencement) */}
          <Text style={styles.secLbl}>Thème du site</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rowScroll}>
            {SITE_TEMPLATES.map(tp => {
              const on = cfg.template === tp.id;
              return (
                <TouchableOpacity key={tp.id} activeOpacity={0.85} onPress={() => setCfg(c => applyTemplate(c, tp.id))}
                  style={[styles.templateChip, on && styles.templateChipOn]}>
                  <Text style={[styles.templateLbl, on && styles.templateLblOn]}>{tp.label}</Text>
                  {on ? <Text style={styles.templateTick}>✓</Text> : null}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <Text style={styles.fieldHint}>Choisis un thème prêt-à-l'emploi, puis ajuste les détails ci-dessous.</Text>

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

          {/* Palette */}
          <Text style={styles.secLbl}>Palette de couleurs</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rowScroll}>
            {SITE_PALETTES.map(p => {
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
            {SITE_FONTS.map(f => {
              const on = cfg.tokens.fontHeading === f.id;
              return (
                <TouchableOpacity key={f.id} activeOpacity={0.8} onPress={() => patchTokens({ fontHeading: f.id })}
                  style={[styles.fontChip, on && styles.chipOn]}>
                  <Text style={[styles.chipLbl, on && styles.chipLblOn]}>{f.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Police texte */}
          <Text style={styles.secLbl}>Police du texte</Text>
          <View style={styles.wrapChips}>
            {SITE_FONTS.map(f => {
              const on = cfg.tokens.fontBody === f.id;
              return (
                <TouchableOpacity key={f.id} activeOpacity={0.8} onPress={() => patchTokens({ fontBody: f.id })}
                  style={[styles.fontChip, on && styles.chipOn]}>
                  <Text style={[styles.chipLbl, on && styles.chipLblOn]}>{f.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Agencement des sections */}
          <Text style={styles.secLbl}>Ordre des sections</Text>
          <View style={styles.orderList}>
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

          {/* Colonnes */}
          <Text style={styles.secLbl}>Colonnes de produits</Text>
          <View style={styles.wrapChips}>
            {COLS_OPTIONS.map(n => {
              const on = cfg.layout.cols === n;
              return (
                <TouchableOpacity key={n} activeOpacity={0.8} onPress={() => patchLayout({ cols: n })}
                  style={[styles.fontChip, on && styles.chipOn]}>
                  <Text style={[styles.chipLbl, on && styles.chipLblOn]}>{n} colonnes</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Style des cartes */}
          <Text style={styles.secLbl}>Style des cartes</Text>
          <View style={styles.wrapChips}>
            {CARD_STYLES.map(cs => {
              const on = cfg.layout.card === cs.id;
              return (
                <TouchableOpacity key={cs.id} activeOpacity={0.8} onPress={() => patchLayout({ card: cs.id })}
                  style={[styles.fontChip, on && styles.chipOn]}>
                  <Text style={[styles.chipLbl, on && styles.chipLblOn]}>{cs.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* En-tête */}
          <Text style={styles.secLbl}>En-tête (hero)</Text>
          <View style={styles.wrapChips}>
            {HERO_STYLES.map(hs => {
              const on = cfg.layout.hero === hs.id;
              return (
                <TouchableOpacity key={hs.id} activeOpacity={0.8} onPress={() => patchLayout({ hero: hs.id })}
                  style={[styles.fontChip, on && styles.chipOn]}>
                  <Text style={[styles.chipLbl, on && styles.chipLblOn]}>{hs.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity style={styles.resetBtn} onPress={onReset} activeOpacity={0.8}>
            <Text style={styles.resetTxt}>Réinitialiser au design par défaut</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* Barre d'enregistrement */}
      {!loading && (
        <View style={styles.saveBar}>
          <TouchableOpacity style={styles.saveBtn} onPress={onSave} activeOpacity={0.85} disabled={saving}>
            {saving ? <ActivityIndicator color={colors.bg} /> : <Text style={styles.saveTxt}>Enregistrer</Text>}
          </TouchableOpacity>
        </View>
      )}
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

  previewWrap: { height: 420, marginHorizontal: spacing.screen, borderRadius: radius.xl, overflow: 'hidden', backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border },
  webview: { flex: 1, backgroundColor: '#fff' },
  webLoading: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  noPreview: { color: '#888', fontSize: 13, textAlign: 'center', paddingHorizontal: 20 },
  previewHint: { color: colors.muted, fontSize: 12, fontFamily: fonts.body, marginHorizontal: spacing.screen, marginTop: 8, lineHeight: 17 },

  secLbl: { color: colors.white, fontFamily: fonts.ui, fontSize: 14, marginHorizontal: spacing.screen, marginTop: 24, marginBottom: 10 },
  input: { marginHorizontal: spacing.screen, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 13 : 10, color: colors.white, fontFamily: fonts.body, fontSize: 15 },
  fieldHint: { color: colors.muted, fontSize: 11.5, fontFamily: fonts.body, marginHorizontal: spacing.screen, marginTop: 6 },

  rowScroll: { paddingHorizontal: spacing.screen, gap: 10 },
  templateChip: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 20, paddingVertical: 12 },
  templateChipOn: { borderColor: colors.accent, backgroundColor: colors.accent },
  templateLbl: { color: colors.white, fontFamily: fonts.ui, fontSize: 14 },
  templateLblOn: { color: colors.bg },
  templateTick: { color: colors.bg, fontSize: 14, fontWeight: '800' },
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
