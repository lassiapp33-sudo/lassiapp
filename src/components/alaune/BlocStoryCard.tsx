import React, { useState } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { IcoLightning, IcoCart } from '../common/LassiIcons';
import { colors, fonts, radius } from '../../theme';
import type { BlocALaUne } from '../../types/aLaUne';

export const STORY_W = 360;
export const STORY_H_BASE = 580;

const MASCOTTE = require('../../../assets/mascotte/lassi-roi.png');
const PLAYSTORE = require('../../../assets/playstore.png');
const APPSTORE = require('../../../assets/appstore.png');

// ─── Formatage numéro sénégalais ──────────────────────────────────────────────

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  // +221 XX XXX XX XX (12 chiffres avec indicatif)
  if (digits.startsWith('221') && digits.length === 12) {
    return `+221 ${digits.slice(3, 5)} ${digits.slice(5, 8)} ${digits.slice(8, 10)} ${digits.slice(10, 12)}`;
  }
  // XX XXX XX XX (9 chiffres locaux)
  if (digits.length === 9) {
    return `+221 ${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 7)} ${digits.slice(7, 9)}`;
  }
  return raw;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  bloc: BlocALaUne;
  shopName: string;
  shopLogoUrl?: string | null;
  shopPhone?: string | null;
  isShopOpen?: boolean;
  countdown: string;
  productImageUri?: string | null;
}

// ─── Composant ────────────────────────────────────────────────────────────────

const BlocStoryCard = React.forwardRef<View, Props>(
  ({ bloc, shopName, shopLogoUrl, shopPhone, isShopOpen, countdown, productImageUri }, ref) => {
    const [imgHeight, setImgHeight] = useState(Math.round(STORY_W * (4 / 5)));
    const shownEls = bloc.elements.slice(0, 5);
    const extraCount = bloc.elements.length - shownEls.length;
    const initial = shopName.trim().charAt(0).toUpperCase();
    const hasSubInfo = shopPhone || isShopOpen !== undefined;

    return (
      <View ref={ref} style={styles.card} collapsable={false}>
        {/* Barre accent haut */}
        <View style={styles.topBar} />

        {/* ── En-tête ── */}
        <View style={styles.headerRow}>
          <View style={styles.alaUneTag}>
            <IcoLightning size={14} />
            <Text style={styles.alaUneLabel}>À la une</Text>
          </View>
          <Image source={MASCOTTE} style={styles.mascotte} resizeMode="contain" />
        </View>

        {/* ── Boutique ── */}
        <View style={styles.shopRow}>
          {shopLogoUrl ? (
            <Image source={{ uri: shopLogoUrl }} style={styles.shopLogo} />
          ) : (
            <View style={styles.shopAvatarFallback}>
              <Text style={styles.shopAvatarInitial}>{initial}</Text>
            </View>
          )}

          <View style={styles.shopInfo}>
            <Text style={styles.shopName} numberOfLines={1}>{shopName}</Text>

            {hasSubInfo && (
              <View style={styles.shopSubRow}>
                {isShopOpen !== undefined && (
                  <View style={[styles.statusBadge, isShopOpen ? styles.statusOpen : styles.statusClosed, { flexDirection: 'row', alignItems: 'center' }]}>
                    <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: isShopOpen ? colors.success : colors.danger, marginRight: 4 }} />
                    <Text style={[styles.statusTxt, { color: isShopOpen ? colors.success : colors.danger }]}>
                      {isShopOpen ? 'Ouvert' : 'Fermé'}
                    </Text>
                  </View>
                )}
                {shopPhone ? (
                  <Text style={styles.phoneTxt}>{formatPhone(shopPhone)}</Text>
                ) : null}
              </View>
            )}
          </View>
        </View>

        {/* ── Séparateur ── */}
        <View style={styles.divider} />

        {/* ── Titre + description ── */}
        {bloc.titre !== 'Affiche' && (
          <View style={styles.titleBlock}>
            <Text style={styles.titre} numberOfLines={3}>{bloc.titre}</Text>
            {bloc.description ? (
              <Text style={styles.desc} numberOfLines={2}>{bloc.description}</Text>
            ) : null}
          </View>
        )}

        {/* ── Éléments ── */}
        <View style={styles.elementsList}>
          {shownEls.map((el) => (
            <View key={el.id} style={styles.elRow}>
              <Text style={styles.elNom} numberOfLines={1}>{el.nom}</Text>
              <Text style={styles.elPrix}>{el.prix.toLocaleString('fr-FR')} F</Text>
            </View>
          ))}
          {extraCount > 0 && (
            <Text style={styles.extraEls}>
              + {extraCount} autre{extraCount > 1 ? 's' : ''} produit{extraCount > 1 ? 's' : ''}
            </Text>
          )}
        </View>

        {/* ── Séparateur ── */}
        <View style={styles.divider} />

        {/* ── Countdown ── */}
        <Text style={styles.countdown}>Encore {countdown}</Text>

        {/* ── CTA ── */}
        <View style={styles.ctaBox}>
          <IcoCart size={14} color="#14152A" />
          <Text style={styles.ctaTxt}>Commander sur LASSİ</Text>
        </View>

        {/* ── Photo produit (optionnelle) ── */}
        {productImageUri ? (
          <Image
            source={{ uri: productImageUri }}
            style={[styles.productImage, { height: imgHeight }]}
            resizeMode="cover"
            onLoad={(e) => {
              const { width, height } = e.nativeEvent.source;
              if (width > 0) setImgHeight(Math.round(STORY_W * height / width));
            }}
          />
        ) : null}

        {/* ── Pied de page ── */}
        <View style={styles.footer}>
          <View style={styles.footerAccentLine} />
          <View style={styles.footerRow}>
            <Image source={PLAYSTORE} style={styles.storeIcon} resizeMode="contain" />
            <Image source={APPSTORE} style={styles.storeIcon} resizeMode="contain" />
            <Text style={styles.footerTxt}>Propulsé par LASSİ 🇸🇳</Text>
          </View>
        </View>
      </View>
    );
  },
);

BlocStoryCard.displayName = 'BlocStoryCard';
export default BlocStoryCard;

// ─── Styles ───────────────────────────────────────────────────────────────────

const INNER_W = STORY_W - 40;

const styles = StyleSheet.create({
  card: {
    width: STORY_W,
    backgroundColor: colors.bg,
  },

  topBar: {
    width: STORY_W,
    height: 5,
    backgroundColor: colors.accent,
  },

  // En-tête
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 10,
  },
  alaUneTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.accent + '25',
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  alaUneLabel: {
    color: colors.accent,
    fontFamily: fonts.ui,
    fontSize: 12,
    letterSpacing: 0.5,
  },
  mascotte: { width: 48, height: 56 },

  // Boutique
  shopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 20,
    marginBottom: 4,
  },
  shopLogo: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    marginTop: 2,
  },
  shopAvatarFallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  shopAvatarInitial: {
    color: colors.bg,
    fontFamily: fonts.title,
    fontSize: 15,
  },
  shopInfo: { flex: 1 },
  shopName: {
    color: colors.muted,
    fontFamily: fonts.ui,
    fontSize: 12.5,
    marginBottom: 4,
  },
  shopSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  statusBadge: {
    borderRadius: radius.pill,
    paddingHorizontal: 7,
    paddingVertical: 2,
    backgroundColor: colors.surface,
  },
  statusOpen: { backgroundColor: colors.success + '20' },
  statusClosed: { backgroundColor: colors.danger + '20' },
  statusTxt: {
    fontFamily: fonts.label,
    fontSize: 10.5,
  },
  phoneTxt: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 10.5,
  },

  // Séparateur
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: 20,
    marginVertical: 11,
  },

  // Titre
  titleBlock: {
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  titre: {
    color: colors.white,
    fontFamily: fonts.titleXL,
    fontSize: 21,
    lineHeight: 27,
    marginBottom: 5,
  },
  desc: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12.5,
    lineHeight: 18,
  },

  // Éléments
  elementsList: {
    paddingHorizontal: 20,
    gap: 8,
  },
  elRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  elNom: {
    color: colors.white,
    fontFamily: fonts.label,
    fontSize: 13.5,
    flex: 1,
    marginRight: 12,
  },
  elPrix: {
    color: colors.accent,
    fontFamily: fonts.ui,
    fontSize: 13.5,
  },
  extraEls: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11.5,
    marginTop: 2,
  },

  // Countdown + CTA
  countdown: {
    color: colors.white,
    fontFamily: fonts.label,
    fontSize: 13.5,
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  ctaBox: {
    alignSelf: 'center',
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingVertical: 7,
    paddingHorizontal: 22,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ctaTxt: {
    color: colors.bg,
    fontFamily: fonts.title,
    fontSize: 12,
  },

  // Photo produit (hauteur calculée dynamiquement via onLoad)
  productImage: {
    width: STORY_W,
    marginHorizontal: 0,
    borderRadius: 0,
    marginBottom: 0,
    backgroundColor: colors.surface,
  },

  // Pied de page
  footer: {
    backgroundColor: colors.surface,
    paddingVertical: 10,
  },
  footerAccentLine: {
    height: 1,
    backgroundColor: colors.accent + '35',
    marginBottom: 8,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  storeIcon: { width: 20, height: 20 },
  footerTxt: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 10.5,
    letterSpacing: 0.3,
  },
});
