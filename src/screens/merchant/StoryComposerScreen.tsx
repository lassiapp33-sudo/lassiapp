/**
 * StoryComposerScreen — Le prestataire poste ses stories « Ça bouge ».
 * Photo + légende + prix + stock. Quota 3/jour (5 si 5 Étoiles). Streak 🔥.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { colors, fonts, radius, TOP_INSET } from '../../theme';
import LassiScreen from '../../components/LassiScreen';
import { IcoBack } from '../../components/icons';
import StoryViewer from '../../components/stories/StoryViewer';
import useShopStore from '../../store/shopStore';
import { pickGalleryImage, pickImageFromCamera } from '../../services/storage';
import { postStory, getMyStories, deleteStory, Story, ShopStories } from '../../services/stories';

// ─── Icônes (charte Lassi, ligne accent) ─────────────────────────────────────
const IcoCamera = () => (
  <Svg width={26} height={26} viewBox="0 0 24 24" fill="none" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" stroke={colors.accent} />
    <Circle cx={12} cy={13} r={4} stroke={colors.accent} />
  </Svg>
);
const IcoImage = () => (
  <Svg width={26} height={26} viewBox="0 0 24 24" fill="none" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    <Rect x={3} y={3} width={18} height={18} rx={2} stroke={colors.accent} />
    <Circle cx={8.5} cy={8.5} r={1.5} stroke={colors.accent} />
    <Path d="m21 15-5-5L5 21" stroke={colors.accent} />
  </Svg>
);
const IcoEye = () => (
  <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke={colors.white} />
    <Circle cx={12} cy={12} r={3} stroke={colors.white} />
  </Svg>
);
const IcoHeart = () => (
  <Svg width={13} height={13} viewBox="0 0 24 24" fill={colors.accent} stroke={colors.accent} strokeWidth={1.4}>
    <Path d="M12 17.8 5.8 21 7 14.1 2 9.3l7-1L12 2l3 6.3 7 1-5 4.8 1.2 6.9z" />
  </Svg>
);

interface Props {
  onBack: () => void;
}

export default function StoryComposerScreen({ onBack }: Props) {
  const shopId = useShopStore(s => s.shopId);
  const shopName = useShopStore(s => s.profile.name);
  const shopLogoUrl = useShopStore(s => s.profile.logoUrl);
  const [viewerOpen, setViewerOpen] = useState(false);

  const [localUri, setLocalUri] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  const [posting, setPosting] = useState(false);

  const [mine, setMine] = useState<Story[]>([]);
  const [streak, setStreak] = useState(0);
  const [quotaLeft, setQuotaLeft] = useState(3);
  const [quota, setQuota] = useState(3);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!shopId) return;
    try {
      const r = await getMyStories(shopId);
      setMine(r.stories);
      setStreak(r.streak);
      setQuota(r.quota);
      setQuotaLeft(r.quotaLeft);
    } finally {
      setLoading(false);
    }
  }, [shopId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const choose = async (fromCamera: boolean) => {
    const uri = fromCamera ? await pickImageFromCamera() : await pickGalleryImage();
    if (uri) setLocalUri(uri);
  };

  const publish = async () => {
    if (!shopId || !localUri) return;
    setPosting(true);
    try {
      await postStory({
        shopId,
        localUri,
        caption: caption.trim() || undefined,
        price: price ? Number(price) : null,
        stock: stock ? Number(stock) : null,
      });
      setLocalUri(null);
      setCaption('');
      setPrice('');
      setStock('');
      await refresh();
      Alert.alert('Publié 🔥', 'Ta story est en ligne pour 24h.');
    } catch (e) {
      Alert.alert('Oups', e instanceof Error ? e.message : 'Publication impossible.');
    } finally {
      setPosting(false);
    }
  };

  const remove = (id: string) => {
    Alert.alert('Supprimer', 'Retirer cette story ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          try { await deleteStory(id); await refresh(); } catch { /* silencieux */ }
        },
      },
    ]);
  };

  const canPost = quotaLeft > 0;

  return (
    <LassiScreen
      header={
        <View style={[styles.head, { paddingTop: TOP_INSET }]}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn} hitSlop={10}>
            <IcoBack />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Ça bouge</Text>
            <Text style={styles.subtitle}>Publie ta nouveauté du jour</Text>
          </View>
          {streak > 0 && (
            <View style={styles.streakPill}>
              <Text style={styles.streakTxt}>🔥 {streak} j</Text>
            </View>
          )}
        </View>
      }
    >
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.accent} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          automaticallyAdjustKeyboardInsets
        >
          {/* Quota */}
          <View style={styles.quotaBox}>
            <Text style={styles.quotaTxt}>
              {canPost
                ? `Il te reste ${quotaLeft} story${quotaLeft > 1 ? 's' : ''} aujourd'hui (sur ${quota})`
                : 'Quota du jour atteint — reviens demain'}
            </Text>
          </View>

          {canPost && (
            <>
              {/* Aperçu / choix photo */}
              {localUri ? (
                <View style={styles.previewWrap}>
                  <Image source={{ uri: localUri }} style={styles.preview} contentFit="cover" />
                  <TouchableOpacity style={styles.changeBtn} onPress={() => setLocalUri(null)}>
                    <Text style={styles.changeTxt}>Changer</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.pickRow}>
                  <TouchableOpacity style={styles.pickBtn} onPress={() => choose(true)} activeOpacity={0.85}>
                    <IcoCamera />
                    <Text style={styles.pickTxt}>Prendre une photo</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.pickBtn} onPress={() => choose(false)} activeOpacity={0.85}>
                    <IcoImage />
                    <Text style={styles.pickTxt}>Galerie</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Champs */}
              <TextInput
                style={styles.input}
                value={caption}
                onChangeText={setCaption}
                placeholder="Légende (ex: Thiéboudienne du jour, chaud !)"
                placeholderTextColor={colors.muted}
                multiline
                maxLength={200}
              />
              <View style={styles.dualRow}>
                <TextInput
                  style={[styles.input, styles.half]}
                  value={price}
                  onChangeText={t => setPrice(t.replace(/[^0-9]/g, ''))}
                  placeholder="Prix (FCFA)"
                  placeholderTextColor={colors.muted}
                  keyboardType="number-pad"
                />
                <TextInput
                  style={[styles.input, styles.half]}
                  value={stock}
                  onChangeText={t => setStock(t.replace(/[^0-9]/g, ''))}
                  placeholder="Stock (option)"
                  placeholderTextColor={colors.muted}
                  keyboardType="number-pad"
                />
              </View>

              <TouchableOpacity
                style={[styles.publishBtn, (!localUri || posting) && styles.publishDisabled]}
                onPress={publish}
                disabled={!localUri || posting}
                activeOpacity={0.9}
              >
                {posting ? (
                  <ActivityIndicator color={colors.bg} />
                ) : (
                  <Text style={styles.publishTxt}>Publier ma story</Text>
                )}
              </TouchableOpacity>
            </>
          )}

          {/* Mes stories en ligne */}
          {mine.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>En ligne ({mine.length})</Text>
              <Text style={styles.sectionHint}>Touche une story pour voir et répondre aux commentaires</Text>
              <View style={styles.mineGrid}>
                {mine.map(s => (
                  <TouchableOpacity
                    key={s.id}
                    style={styles.mineItem}
                    activeOpacity={0.85}
                    onPress={() => setViewerOpen(true)}
                  >
                    <Image source={{ uri: s.mediaUrl }} style={styles.mineImg} contentFit="cover" />
                    <View style={styles.mineStats}>
                      <View style={styles.statCell}><IcoEye /><Text style={styles.mineStat}>{s.viewsCount}</Text></View>
                      <View style={styles.statCell}><IcoHeart /><Text style={styles.mineStat}>{s.reactionsCount}</Text></View>
                    </View>
                    <TouchableOpacity style={styles.delBtn} onPress={() => remove(s.id)} hitSlop={8}>
                      <Text style={styles.delTxt}>✕</Text>
                    </TouchableOpacity>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
        </ScrollView>
      )}

      {viewerOpen && shopId && mine.length > 0 && (
        <StoryViewer
          shops={[{
            shopId,
            shopName: shopName || 'Ma boutique',
            shopLogoUrl: shopLogoUrl ?? null,
            isVip: false,
            streak,
            hasUnseen: false,
            stories: mine,
          } as ShopStories]}
          initialShopIndex={0}
          ownerMode
          onClose={() => { setViewerOpen(false); refresh(); }}
          onShopSeen={() => {}}
          onOpenShop={() => setViewerOpen(false)}
          onContactShop={() => setViewerOpen(false)}
        />
      )}
    </LassiScreen>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { color: colors.white, fontFamily: fonts.titleXL, fontSize: 20 },
  subtitle: { color: colors.muted, fontFamily: fonts.body, fontSize: 12, marginTop: 1 },
  streakPill: {
    backgroundColor: 'rgba(253,207,52,0.14)',
    borderWidth: 1, borderColor: colors.accent,
    borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6,
  },
  streakTxt: { color: colors.accent, fontFamily: fonts.title, fontSize: 12 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  body: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 },

  quotaBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    padding: 12, marginBottom: 16,
  },
  quotaTxt: { color: colors.white, fontFamily: fonts.label, fontSize: 12.5, textAlign: 'center' },

  pickRow: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  pickBtn: {
    flex: 1, height: 120, borderRadius: radius.lg,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  pickEmoji: { fontSize: 26 },
  pickTxt: { color: colors.muted, fontFamily: fonts.label, fontSize: 12 },

  previewWrap: { marginBottom: 14, borderRadius: radius.lg, overflow: 'hidden' },
  preview: { width: '100%', aspectRatio: 1, backgroundColor: colors.surface },
  changeBtn: {
    position: 'absolute', top: 10, right: 10,
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 999,
    paddingHorizontal: 14, paddingVertical: 7,
  },
  changeTxt: { color: colors.white, fontFamily: fonts.title, fontSize: 12 },

  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    color: colors.white, fontFamily: fonts.body, fontSize: 14,
    paddingHorizontal: 14, paddingVertical: 12, marginBottom: 12,
    minHeight: 48,
  },
  dualRow: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },

  publishBtn: {
    backgroundColor: colors.accent, borderRadius: radius.md,
    paddingVertical: 15, alignItems: 'center', marginTop: 4,
  },
  publishDisabled: { opacity: 0.5 },
  publishTxt: { color: colors.bg, fontFamily: fonts.titleXL, fontSize: 15 },

  sectionTitle: { color: colors.white, fontFamily: fonts.title, fontSize: 15, marginTop: 26, marginBottom: 2 },
  sectionHint: { color: colors.muted, fontFamily: fonts.body, fontSize: 11.5, marginBottom: 12 },
  statCell: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  mineGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  mineItem: { width: '30%', aspectRatio: 0.72, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surface },
  mineImg: { width: '100%', height: '100%' },
  mineStats: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-around',
    backgroundColor: 'rgba(0,0,0,0.55)', paddingVertical: 5,
  },
  mineStat: { color: colors.white, fontFamily: fonts.label, fontSize: 10.5 },
  delBtn: {
    position: 'absolute', top: 6, right: 6,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center',
  },
  delTxt: { color: colors.white, fontSize: 13, fontFamily: fonts.title },
});
