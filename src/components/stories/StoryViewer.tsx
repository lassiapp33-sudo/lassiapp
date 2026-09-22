/**
 * StoryViewer — Lecteur plein écran des stories « Ça bouge ».
 * Navigue à travers les boutiques et leurs stories, réactions 1-tap,
 * commentaires + bouton « Commander » quand une intention d'achat est détectée.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { Image } from 'expo-image';
import { colors, fonts, radius } from '../../theme';
import Avatar from '../Avatar';
import {
  ShopStories,
  ReactionType,
  recordStoryView,
  reactToStory,
  unreactStory,
  commentStory,
  getStoryComments,
  StoryComment,
} from '../../services/stories';

interface Props {
  shops: ShopStories[];
  initialShopIndex: number;
  onClose: () => void;
  onShopSeen: (shopIndex: number) => void;
  onOpenShop: (shopId: string, shopName: string) => void;
  onContactShop: (shopId: string, shopName: string, shopLogoUrl: string | null) => void;
  /** true = le prestataire regarde sa propre story (répond aux commentaires) */
  ownerMode?: boolean;
}

const STORY_MS = 7000;

// Phrase-lien vers la vitrine (suggestion prestataire)
const VITRINE_PHRASE = 'Voici ma vitrine 👉';
const OWNER_SUGGESTIONS = [VITRINE_PHRASE, 'Oui, dispo', 'Merci 🙏', "J'arrive"];
const CLIENT_SUGGESTIONS = ["C'est combien ?", 'Je prends', 'Livraison possible ?', 'Encore dispo ?'];

function isVitrineComment(t: string): boolean {
  return /voici ma vitrine|ma vitrine/i.test(t);
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h >= 1) return `il y a ${h}h`;
  const m = Math.floor(diff / 60_000);
  return m >= 1 ? `il y a ${m} min` : "à l'instant";
}

export default function StoryViewer({
  shops,
  initialShopIndex,
  onClose,
  onShopSeen,
  onOpenShop,
  onContactShop,
  ownerMode = false,
}: Props) {
  const [shopIdx, setShopIdx] = useState(initialShopIndex);
  const [storyIdx, setStoryIdx] = useState(0);

  // État local des réactions / compteurs (optimiste)
  const [reactions, setReactions] = useState<Record<string, ReactionType | null>>({});
  const [counts, setCounts] = useState<Record<string, number>>({});

  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<StoryComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [text, setText] = useState('');
  const [replyUserId, setReplyUserId] = useState<string | null>(null);
  const [replyName, setReplyName] = useState<string | null>(null);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<TextInput>(null);
  const listRef = useRef<ScrollView>(null);
  const pulse = useRef(new Animated.Value(1)).current;

  // Clignotement du bouton « Commenter »
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.35, duration: 650, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 650, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const shop = shops[shopIdx];
  const story = shop?.stories[storyIdx];

  // ── Enregistre la vue + initialise l'état local à chaque story ──────────────
  useEffect(() => {
    if (!story) return;
    recordStoryView(story.id);
    setReactions(r => (story.id in r ? r : { ...r, [story.id]: story.viewerReaction ?? null }));
    setCounts(c => (story.id in c ? c : { ...c, [story.id]: story.reactionsCount }));
    setReplyUserId(null);
  }, [story]);

  // ── Auto-défilement (pause quand les commentaires sont ouverts) ─────────────
  const goNext = useCallback(() => {
    onShopSeen(shopIdx);
    if (shop && storyIdx < shop.stories.length - 1) {
      setStoryIdx(i => i + 1);
    } else if (shopIdx < shops.length - 1) {
      setShopIdx(i => i + 1);
      setStoryIdx(0);
    } else {
      onClose();
    }
  }, [shop, storyIdx, shopIdx, shops.length, onShopSeen, onClose]);

  const goPrev = () => {
    if (storyIdx > 0) {
      setStoryIdx(i => i - 1);
    } else if (shopIdx > 0) {
      const prev = shops[shopIdx - 1];
      setShopIdx(i => i - 1);
      setStoryIdx(Math.max(prev.stories.length - 1, 0));
    }
  };

  useEffect(() => {
    if (showComments || !story) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(goNext, STORY_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [story, showComments, goNext]);

  // ── Réactions ────────────────────────────────────────────────────────────────
  const toggleReaction = async (type: ReactionType) => {
    if (!story) return;
    const current = reactions[story.id] ?? null;
    if (current === type) {
      setReactions(r => ({ ...r, [story.id]: null }));
      setCounts(c => ({ ...c, [story.id]: Math.max((c[story.id] ?? 1) - 1, 0) }));
      try { await unreactStory(story.id); } catch { /* silencieux */ }
    } else {
      setReactions(r => ({ ...r, [story.id]: type }));
      if (current === null) setCounts(c => ({ ...c, [story.id]: (c[story.id] ?? 0) + 1 }));
      try { await reactToStory(story.id, type); } catch { /* silencieux */ }
    }
  };

  // ── Commentaires ─────────────────────────────────────────────────────────────
  const openComments = async () => {
    if (!story) return;
    setShowComments(true);
    setLoadingComments(true);
    try {
      setComments(await getStoryComments(story.id));
    } catch {
      setComments([]);
    } finally {
      setLoadingComments(false);
    }
  };

  const sendText = async (raw: string) => {
    const body = raw.trim();
    if (!story || !body) return;
    const reply = ownerMode ? replyUserId : null;
    setText('');
    setReplyUserId(null);
    setReplyName(null);
    try {
      const c = await commentStory(story.id, body, reply);
      setComments(prev => [...prev, c]);
      // Reste fixé sur le commentaire qu'on vient de poster
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
    } catch { /* silencieux */ }
  };

  const send = () => sendText(text);

  // Répondre à un commentaire → préremplit la mention, cible le client, focus
  const replyTo = (name: string, userId: string) => {
    if (!ownerMode) return; // seul le prestataire répond en taguant
    setReplyUserId(userId);
    setReplyName(name);
    setText(prev => (prev.startsWith('@') ? prev : `@${name} ${prev}`));
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const cancelReply = () => {
    const mention = replyName ? `@${replyName} ` : '';
    setReplyUserId(null);
    setReplyName(null);
    setText(t => (mention && t.startsWith(mention) ? t.slice(mention.length) : t));
  };

  const commander = () => {
    if (!shop) return;
    onContactShop(shop.shopId, shop.shopName, shop.shopLogoUrl);
  };

  const openVitrine = () => {
    if (!shop) return;
    onClose();
    onOpenShop(shop.shopId, shop.shopName);
  };

  const suggestions = ownerMode ? OWNER_SUGGESTIONS : CLIENT_SUGGESTIONS;

  if (!shop || !story) return null;

  const myReaction = reactions[story.id] ?? null;

  return (
    <Modal visible animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        {/* Média */}
        <Image
          key={story.id}
          source={{ uri: story.mediaUrl }}
          style={StyleSheet.absoluteFill}
          contentFit="contain"
          transition={120}
          placeholder={[colors.bg]}
        />

        {/* Zones de tap gauche/droite */}
        {!showComments && (
          <View style={styles.tapRow}>
            <TouchableWithoutFeedback onPress={goPrev}>
              <View style={{ flex: 1 }} />
            </TouchableWithoutFeedback>
            <TouchableWithoutFeedback onPress={goNext}>
              <View style={{ flex: 1.4 }} />
            </TouchableWithoutFeedback>
          </View>
        )}

        {/* Barres de progression */}
        <View style={styles.progressRow}>
          {shop.stories.map((s, i) => (
            <View key={s.id} style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: i < storyIdx ? '100%' : i === storyIdx ? '100%' : '0%' },
                ]}
              />
            </View>
          ))}
        </View>

        {/* En-tête boutique */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerLeft}
            activeOpacity={0.8}
            onPress={() => { onClose(); onOpenShop(shop.shopId, shop.shopName); }}
          >
            <Avatar imageUrl={shop.shopLogoUrl} name={shop.shopName} size={38} variant="shop" />
            <View style={{ marginLeft: 10 }}>
              <View style={styles.nameRow}>
                <Text style={styles.shopName} numberOfLines={1}>{shop.shopName}</Text>
                {shop.streak > 1 && <Text style={styles.streak}>🔥{shop.streak}</Text>}
              </View>
              <Text style={styles.time}>{timeAgo(story.createdAt)} · {story.viewsCount} vues</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} hitSlop={12} style={styles.closeBtn}>
            <Text style={styles.closeTxt}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Légende / prix / stock */}
        {(story.caption || story.price != null) && (
          <View style={styles.captionBox}>
            {story.caption ? <Text style={styles.caption}>{story.caption}</Text> : null}
            {(story.price != null || story.stock != null) && (
              <View style={styles.metaRow}>
                {story.price != null && (
                  <Text style={styles.price}>{story.price.toLocaleString('fr-SN')} F</Text>
                )}
                {story.stock != null && (
                  <Text style={styles.stock}>Stock : {story.stock}</Text>
                )}
              </View>
            )}
          </View>
        )}

        {/* Barre de réactions */}
        {!showComments && (
          <View style={styles.reactionBar}>
            {!ownerMode && (
              <>
                <ReactBtn label="❤️" active={myReaction === 'like'} onPress={() => toggleReaction('like')} />
                <ReactBtn label="🔥" active={myReaction === 'fire'} onPress={() => toggleReaction('fire')} />
                <TouchableOpacity
                  style={[styles.dispoBtn, myReaction === 'dispo' && styles.dispoBtnActive]}
                  onPress={() => toggleReaction('dispo')}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.dispoTxt, myReaction === 'dispo' && styles.dispoTxtActive]}>Dispo ?</Text>
                </TouchableOpacity>
              </>
            )}
            <Animated.View style={[styles.commentBtnCta, { opacity: pulse }]}>
              <TouchableOpacity style={styles.commentBtnHit} onPress={openComments} activeOpacity={0.85}>
                <Text style={styles.commentBtnCtaTxt}>Commenter</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        )}

        {/* Feuille de commentaires */}
        {showComments && (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.sheet}
          >
            <View style={styles.sheetHandleRow}>
              <Text style={styles.sheetTitle}>Commentaires</Text>
              <TouchableOpacity onPress={() => setShowComments(false)} hitSlop={12}>
                <Text style={styles.closeTxt}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              ref={listRef}
              style={styles.commentList}
              keyboardShouldPersistTaps="handled"
              onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
            >
              {loadingComments ? (
                <ActivityIndicator color={colors.accent} style={{ marginTop: 20 }} />
              ) : comments.length === 0 ? (
                <Text style={styles.noComments}>Sois le premier à écrire. Pour commander, écris « je prends » ou « c'est combien ? »</Text>
              ) : (
                comments.map(c => (
                  <TouchableOpacity
                    key={c.id}
                    style={styles.commentItem}
                    activeOpacity={0.7}
                    onPress={() => replyTo(c.userName, c.userId)}
                  >
                    <Avatar imageUrl={c.userAvatar} name={c.userName} size={30} variant="user" />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={styles.commentName}>{c.userName}</Text>
                      <Text style={styles.commentText}>{c.text}</Text>
                      {isVitrineComment(c.text) && (
                        <TouchableOpacity style={styles.vitrineLink} onPress={openVitrine} activeOpacity={0.85}>
                          <Text style={styles.vitrineLinkTxt}>🏪 Ouvrir la vitrine</Text>
                        </TouchableOpacity>
                      )}
                      {c.intentDetected && !ownerMode && (
                        <TouchableOpacity style={styles.inlineOrder} onPress={commander} activeOpacity={0.85}>
                          <Text style={styles.inlineOrderTxt}>🛒 Commander</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>

            {/* Indicateur : réponse à un client */}
            {ownerMode && replyName && (
              <View style={styles.replyBanner}>
                <Text style={styles.replyBannerTxt} numberOfLines={1}>Réponse à {replyName}</Text>
                <TouchableOpacity onPress={cancelReply} hitSlop={10}>
                  <Text style={styles.replyBannerX}>✕</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Réponses rapides suggérées (toujours visibles) */}
            <View style={styles.chipsWrap}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipsContent}
                keyboardShouldPersistTaps="always"
              >
                {suggestions.map(s => (
                  <TouchableOpacity key={s} style={styles.chip} onPress={() => sendText(s)} activeOpacity={0.8}>
                    <Text style={styles.chipTxt} numberOfLines={1}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.inputRow}>
              <TextInput
                ref={inputRef}
                style={styles.input}
                value={text}
                onChangeText={setText}
                placeholder={ownerMode ? 'Réponds à tes clients…' : 'Écris un message…'}
                placeholderTextColor={colors.muted}
                multiline
              />
              <TouchableOpacity style={styles.sendBtn} onPress={send} activeOpacity={0.85}>
                <Text style={styles.sendTxt}>Envoyer</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        )}
      </View>
    </Modal>
  );
}

function ReactBtn({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.reactBtn, active && styles.reactBtnActive]} onPress={onPress} activeOpacity={0.7}>
      <Text style={styles.reactEmoji}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  tapRow: { ...StyleSheet.absoluteFillObject, flexDirection: 'row', top: 90, bottom: 120 },

  progressRow: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 12,
    paddingTop: Platform.OS === 'ios' ? 56 : 20,
  },
  progressTrack: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
    overflow: 'hidden',
  },
  progressFill: { height: 3, backgroundColor: colors.white, borderRadius: 2 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 12,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  shopName: { color: colors.white, fontFamily: fonts.title, fontSize: 14, maxWidth: 180 },
  streak: { color: colors.accent, fontFamily: fonts.title, fontSize: 12 },
  time: { color: 'rgba(255,255,255,0.7)', fontFamily: fonts.body, fontSize: 11, marginTop: 1 },
  closeBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  closeTxt: { color: colors.white, fontSize: 20, fontFamily: fonts.title },

  captionBox: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 96,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: radius.md,
    padding: 12,
  },
  caption: { color: colors.white, fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6 },
  price: { color: colors.accent, fontFamily: fonts.titleXL, fontSize: 18 },
  stock: { color: colors.white, fontFamily: fonts.label, fontSize: 12 },

  reactionBar: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reactBtn: {
    width: 46,
    height: 46,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reactBtnActive: { backgroundColor: 'rgba(253,207,52,0.28)', borderWidth: 1, borderColor: colors.accent },
  reactEmoji: { fontSize: 20 },
  dispoBtn: {
    height: 46,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dispoBtnActive: { backgroundColor: colors.accent },
  dispoTxt: { color: colors.white, fontFamily: fonts.title, fontSize: 13 },
  dispoTxtActive: { color: colors.bg },
  commentBtnCta: {
    flex: 1,
    height: 46,
    borderRadius: 999,
    backgroundColor: colors.accent,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 6,
  },
  commentBtnHit: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  commentBtnCtaTxt: { color: colors.bg, fontFamily: fonts.titleXL, fontSize: 14 },

  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '72%',
    backgroundColor: colors.bg,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 30 : 14,
  },
  sheetHandleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sheetTitle: { color: colors.white, fontFamily: fonts.title, fontSize: 15 },
  commentList: { maxHeight: 280 },
  noComments: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 18,
    lineHeight: 19,
    paddingHorizontal: 20,
  },
  commentItem: { flexDirection: 'row', marginBottom: 14 },
  commentName: { color: colors.white, fontFamily: fonts.title, fontSize: 12.5 },
  commentText: { color: colors.muted, fontFamily: fonts.body, fontSize: 13, marginTop: 2, lineHeight: 18 },
  inlineOrder: {
    alignSelf: 'flex-start',
    marginTop: 6,
    backgroundColor: colors.accent,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  inlineOrderTxt: { color: colors.bg, fontFamily: fonts.title, fontSize: 12 },
  vitrineLink: {
    alignSelf: 'flex-start',
    marginTop: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  vitrineLinkTxt: { color: colors.accent, fontFamily: fonts.title, fontSize: 12 },
  chipsWrap: { height: 40, marginBottom: 8 },
  chipsContent: { gap: 8, alignItems: 'center', paddingRight: 8 },
  chip: {
    height: 36,
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 14,
  },
  chipTxt: { color: colors.white, fontFamily: fonts.label, fontSize: 12.5, lineHeight: 16 },
  replyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(253,207,52,0.12)',
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginBottom: 8,
  },
  replyBannerTxt: { color: colors.accent, fontFamily: fonts.label, fontSize: 12, flex: 1 },
  replyBannerX: { color: colors.accent, fontFamily: fonts.title, fontSize: 14, marginLeft: 10 },
  commanderCta: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 13,
    alignItems: 'center',
    marginBottom: 10,
  },
  commanderTxt: { color: colors.bg, fontFamily: fonts.titleXL, fontSize: 15 },

  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 100,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.white,
    fontFamily: fonts.body,
    fontSize: 14,
    paddingHorizontal: 14,
    paddingTop: 12,
  },
  sendBtn: {
    height: 44,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendTxt: { color: colors.bg, fontFamily: fonts.title, fontSize: 13 },
});
