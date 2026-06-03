import React, {
  useState, useRef, useEffect, useLayoutEffect,
} from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, KeyboardAvoidingView, Platform,
  ScrollView, Image, ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts, TOP_INSET, radius } from '../../theme';
import { contacterServiceClient } from '../../config/contact';
import { LassiMascotte }           from '../../components/LassiMascotte';
import {
  analyserMessage,
  rechercherPrestataires,
  loggerQuestionSansReponse,
  ShopResult,
  CatMatch,
}                                  from '../../services/lassiAssistant';
import { SUGGESTIONS_ACCUEIL }     from '../../data/faqData';
import { CATEGORIES }              from '../../config/categories';
import useAuthStore                from '../../store/authStore';

// ─── Types ───────────────────────────────────────────────────────────────────

type ChatMsg =
  | { id: string; kind: 'bot';         text: string }
  | { id: string; kind: 'user';        text: string }
  | { id: string; kind: 'shops';       shops: ShopResult[]; catLabel: string; zone?: string }
  | { id: string; kind: 'sc' }
  | { id: string; kind: 'chips' }
  | { id: string; kind: 'suggestions' }
  | { id: string; kind: 'loading' };

// ─── Constantes ───────────────────────────────────────────────────────────────

const CHAT_TTL_MS = 72 * 60 * 60 * 1000; // 72 heures
// Clé par utilisateur — jamais partagée entre comptes
function chatKey(userId: string) {
  return `lassi_chat_${userId}`;
}

const SEARCH_CHIPS: { id: string; label: string; emoji: string; imageUri?: number; cat: CatMatch }[] =
  CATEGORIES.flatMap(cat =>
    cat.subcats.map(sub => ({
      id:       `${cat.id}_${sub.id}`,
      label:    sub.label,
      emoji:    sub.emoji,
      imageUri: sub.imageUri,
      cat:      { id: cat.id, label: cat.label } as CatMatch,
    }))
  );

const uid = () => `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

// welcome + chips sont rendus dans le header fixe hors FlatList
function makeInitialMsgs(): ChatMsg[] {
  return [
    { id: uid(), kind: 'bot',         text: "Ou pose-moi une question sur l'app :" },
    { id: uid(), kind: 'suggestions' },
  ];
}

// ─── Icônes ───────────────────────────────────────────────────────────────────

const IcoClose = () => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" strokeWidth={2.2} strokeLinecap="round">
    <Path d="M18 6 6 18M6 6l12 12" stroke={colors.white} />
  </Svg>
);

const IcoSend = ({ active }: { active: boolean }) => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M22 2 11 13" stroke={active ? colors.bg : colors.muted} />
    <Path d="M22 2 15 22 11 13 2 9l20-7Z" stroke={active ? colors.bg : colors.muted} />
  </Svg>
);

const IcoPhone = () => (
  <Svg width={17} height={17} viewBox="0 0 24 24" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.14 13.5a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.05 2.78h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 10.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21 18l-.08-1.08Z" stroke={colors.bg} />
  </Svg>
);

// ─── Sous-composants ──────────────────────────────────────────────────────────

function BotBubble({ text }: { text: string }) {
  return (
    <View style={styles.rowBot}>
      <View style={styles.bubbleBot}>
        <Text style={styles.bubbleTxt}>{text}</Text>
      </View>
    </View>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <View style={styles.rowUser}>
      <View style={styles.bubbleUser}>
        <Text style={styles.bubbleUserTxt}>{text}</Text>
      </View>
    </View>
  );
}

function LoadingBubble() {
  return (
    <View style={styles.rowBot}>
      <View style={[styles.bubbleBot, { paddingVertical: 14 }]}>
        <ActivityIndicator size="small" color={colors.accent} />
      </View>
    </View>
  );
}

function ShopCard({ shop, onPress }: { shop: ShopResult; onPress: () => void }) {
  const initial = shop.name.charAt(0).toUpperCase();

  function fmtDist(m: number) {
    return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
  }

  return (
    <TouchableOpacity style={styles.shopCard} onPress={onPress} activeOpacity={0.82}>
      {/* Logo */}
      <View style={styles.shopLogo}>
        {shop.logoUrl ? (
          <Image source={{ uri: shop.logoUrl }} style={styles.shopLogoImg} />
        ) : (
          <Text style={styles.shopLogoInitial}>{initial}</Text>
        )}
      </View>

      {/* Infos */}
      <View style={styles.shopInfo}>
        <View style={styles.shopNameRow}>
          <Text style={styles.shopName} numberOfLines={1}>{shop.name}</Text>
          {shop.isVip && <Text style={styles.vipBadge}>🥇 VIP</Text>}
        </View>
        <Text style={styles.shopZone} numberOfLines={1}>{shop.zone || shop.category}</Text>
        <View style={styles.shopStatusRow}>
          <View style={[styles.statusDot, { backgroundColor: shop.isOpen ? colors.success : colors.danger }]} />
          <Text style={[styles.statusTxt, { color: shop.isOpen ? colors.success : colors.danger }]}>
            {shop.isOpen ? 'Ouvert' : 'Fermé'}
          </Text>
          {shop.distance != null && (
            <Text style={styles.distTxt}> · {fmtDist(shop.distance)}</Text>
          )}
        </View>
      </View>

      {/* Chevron */}
      <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M9 18l6-6-6-6" stroke={colors.muted} />
      </Svg>
    </TouchableOpacity>
  );
}

function ShopsMessage({ shops, catLabel, zone, onShopPress }: {
  shops: ShopResult[];
  catLabel: string;
  zone?: string;
  onShopPress: (id: string, name: string) => void;
}) {
  const label = zone
    ? `Voici ${shops.length} ${catLabel} que j'ai trouvés à ${zone} 🐝`
    : `Voici ${shops.length} ${catLabel} près de toi 🐝`;

  return (
    <View>
      <View style={styles.rowBot}>
        <View style={styles.bubbleBot}>
          <Text style={styles.bubbleTxt}>{label}</Text>
        </View>
      </View>
      <View style={styles.shopsList}>
        {shops.map(s => (
          <ShopCard key={s.id} shop={s} onPress={() => onShopPress(s.id, s.name)} />
        ))}
      </View>
    </View>
  );
}

function ServiceClientBanner() {
  return (
    <View style={styles.scBanner}>
      <TouchableOpacity
        style={styles.scBtn}
        onPress={() => contacterServiceClient()}
        activeOpacity={0.82}
      >
        <IcoPhone />
        <Text style={styles.scBtnTxt}>Contacter le service client</Text>
      </TouchableOpacity>
    </View>
  );
}

function SearchChips({ onPress }: { onPress: (cat: CatMatch) => void }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.chipsScroll}
      contentContainerStyle={styles.chipsContent}
    >
      {SEARCH_CHIPS.map(c => (
        <TouchableOpacity
          key={c.id}
          style={styles.chip}
          onPress={() => onPress(c.cat)}
          activeOpacity={0.78}
        >
          {c.imageUri
            ? <Image source={c.imageUri} style={styles.chipImg} resizeMode="cover" />
            : <Text style={styles.chipEmoji}>{c.emoji}</Text>
          }
          <Text style={styles.chipTxt}>{c.label}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

function SuggestionsList({ onPress }: { onPress: (q: string) => void }) {
  return (
    <View style={styles.suggWrap}>
      {SUGGESTIONS_ACCUEIL.map(q => (
        <TouchableOpacity key={q} style={styles.suggItem} onPress={() => onPress(q)} activeOpacity={0.78}>
          <Text style={styles.suggTxt}>{q}</Text>
          <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" strokeWidth={2} strokeLinecap="round">
            <Path d="M9 18l6-6-6-6" stroke={colors.muted} />
          </Svg>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

interface Props {
  onClose:     () => void;
  onShopPress: (shopId: string, shopName: string) => void;
}

export default function LassiAssistantScreen({ onClose, onShopPress }: Props) {
  const [messages, setMessages] = useState<ChatMsg[]>(() => makeInitialMsgs());
  const [input,    setInput]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [headerH,  setHeaderH]  = useState(0);
  const listRef                 = useRef<FlatList>(null);
  const inputRef                = useRef<TextInput>(null);

  const user   = useAuthStore(s => s.user);
  const userId = user?.id ?? 'guest';
  const role   = user?.role ?? 'client';
  const profil = (role === 'merchant' ? 'prestataire' : role) as 'client' | 'prestataire' | 'tous';
  const myKey  = chatKey(userId);

  // ── sendRef — mis à jour AVANT chaque rendu (useLayoutEffect synchrone) ─────
  const sendRef       = useRef<(t: string) => void>(() => {});
  const hasLoadedRef  = useRef(false); // empêche la sauvegarde avant le chargement

  // ── Chargement historique (72h, privé par userId) ─────────────────────────
  useEffect(() => {
    AsyncStorage.getItem(myKey)
      .then(raw => {
        if (raw) {
          const { msgs, savedAt } = JSON.parse(raw);
          const isNewFormat = Array.isArray(msgs) && msgs.every((m: ChatMsg) => String(m.id).includes('_'));
          if (isNewFormat && msgs.length > 0 && Date.now() - savedAt < CHAT_TTL_MS) {
            // Retirer les anciens chips/welcome du format précédent (maintenant dans le header fixe)
            const cleaned: ChatMsg[] = msgs.filter(
              (m: ChatMsg) => m.kind !== 'chips' &&
                !(m.kind === 'bot' && (m as any).text?.startsWith('Salut ! Je suis Lassi'))
            );
            setMessages(cleaned.length > 0 ? cleaned : makeInitialMsgs());
          } else {
            AsyncStorage.removeItem(myKey).catch(() => {});
          }
        }
      })
      .catch(() => {})
      .finally(() => { hasLoadedRef.current = true; });
  }, [myKey]);

  // ── Sauvegarde automatique (uniquement pour cet utilisateur) ──────────────
  useEffect(() => {
    if (!hasLoadedRef.current) return;
    const toSave = messages.filter(m => m.kind !== 'loading');
    AsyncStorage.setItem(myKey, JSON.stringify({
      msgs:    toSave,
      savedAt: Date.now(),
    })).catch(() => {});
  }, [messages, myKey]);

  // ── Auto-scroll ─────────────────────────────────────────────────────────────
  useEffect(() => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
  }, [messages]);

  // ── handleSend — fonction normale (pas useCallback) ────────────────────────
  // Redéfinie à chaque rendu → capture toujours loading/profil frais
  // sendRef.current est mis à jour via useLayoutEffect AVANT que le DOM commit
  async function handleSend(texte: string) {
    const txt = texte.trim();
    if (!txt || loading) return;

    setMessages(prev => [...prev, { id: uid(), kind: 'user', text: txt }]);
    setInput('');

    const loadId = uid();
    setLoading(true);
    setMessages(prev => [...prev, { id: loadId, kind: 'loading' }]);

    try {
      const intent = analyserMessage(txt, profil, null);

      if (intent.type === 'salutation' && intent.reponse) {
        setMessages(prev => [
          ...prev.filter(m => m.id !== loadId),
          { id: uid(), kind: 'bot' as const, text: intent.reponse! },
        ]);

      } else if (intent.type === 'search' && intent.categorie) {
        const shops = await rechercherPrestataires(intent.categorie.id, intent.zone, null);
        setMessages(prev => {
          const base = prev.filter(m => m.id !== loadId);
          if (shops.length === 0) {
            const loc = intent.zone ? ` à ${intent.zone}` : '';
            return [...base, {
              id: uid(), kind: 'bot' as const,
              text: `Je n'ai trouvé aucun ${intent.categorie!.label}${loc} pour l'instant 🐝\nEssaie une autre zone ou regarde la carte !`,
            }];
          }
          return [...base, {
            id: uid(), kind: 'shops' as const,
            shops, catLabel: intent.categorie!.label, zone: intent.zone,
          }];
        });

      } else if (intent.type === 'faq' && intent.faq) {
        setMessages(prev => [
          ...prev.filter(m => m.id !== loadId),
          { id: uid(), kind: 'bot' as const, text: intent.faq!.reponse },
        ]);

      } else {
        await loggerQuestionSansReponse(txt);
        setMessages(prev => [
          ...prev.filter(m => m.id !== loadId),
          { id: uid(), kind: 'bot' as const, text: 'Je n\'ai pas bien compris 🐝\nEssaie "coiffeur à Patte d\'Oie" ou pose une question sur l\'app. Le service client peut aussi t\'aider !' },
          { id: uid(), kind: 'sc' as const },
        ]);
      }
    } catch {
      setMessages(prev => [
        ...prev.filter(m => m.id !== loadId),
        { id: uid(), kind: 'bot' as const, text: 'Une erreur est survenue. Réessaie ou contacte le service client.' },
        { id: uid(), kind: 'sc' as const },
      ]);
    } finally {
      setLoading(false);
    }
  }

  // useLayoutEffect — synchrone, s'exécute avant que le navigateur peigne
  // garantit que sendRef.current = la toute dernière handleSend AVANT tout tap
  useLayoutEffect(() => {
    sendRef.current = handleSend;
  });

  // ── Rendu item ────────────────────────────────────────────────────────────────
  function renderItem({ item }: { item: ChatMsg }) {
    switch (item.kind) {
      case 'bot':
        return <BotBubble text={item.text} />;
      case 'user':
        return <UserBubble text={item.text} />;
      case 'loading':
        return <LoadingBubble />;
      case 'shops':
        return (
          <ShopsMessage
            shops={item.shops}
            catLabel={item.catLabel}
            zone={item.zone}
            onShopPress={onShopPress}
          />
        );
      case 'sc':
        return <ServiceClientBanner />;
      case 'chips':
        return <SearchChips onPress={(cat) => sendRef.current(cat.label)} />;
      case 'suggestions':
        return <SuggestionsList onPress={(q) => sendRef.current(q)} />;
      default:
        return null;
    }
  }

  const hasInput = input.trim().length > 0;

  // ── Rendu ─────────────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* ══ ZONE HAUTE FIXE — ne défile jamais ══════════════════════════════ */}
      <View onLayout={e => setHeaderH(e.nativeEvent.layout.height)}>
        <View style={[styles.header, { paddingTop: TOP_INSET }]}>
          <Text style={styles.headerTitle}>✨ Assistant LASSİ</Text>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.75}>
            <IcoClose />
          </TouchableOpacity>
        </View>
        <View style={styles.mascotteSection}>
          <LassiMascotte forme="search" taille={80} animation="peek" glow boucle />
        </View>
        <BotBubble text={'Salut ! Je suis Lassi 🐝\nPose-moi ta question ou cherche un commerce près de toi !'} />
        <SearchChips onPress={cat => sendRef.current(cat.label)} />
      </View>

      {/* ══ ZONE CENTRALE DÉFILANTE ══════════════════════════════════════════ */}
      <View style={styles.chatWrap}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={m => m.id}
          renderItem={renderItem}
          contentContainerStyle={styles.chatContent}
          style={styles.chat}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        />
      </View>

      {/* Fondu BAS — contenu s'estompe vers la barre de saisie */}
      <View style={styles.fadeBottom} pointerEvents="none">
        {Array.from({ length: 8 }, (_, i) => (
          <View key={i} style={{ flex: 1, backgroundColor: `rgba(20,21,42,${(i / 7) * 0.95})` }} />
        ))}
      </View>

      {/* ── Barre de saisie ──────────────────────────────────────────────────── */}
      <View style={styles.inputBar}>
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Pose ta question à Lassi..."
          placeholderTextColor={colors.muted}
          onSubmitEditing={() => sendRef.current(input)}
          returnKeyType="send"
          multiline={false}
          maxLength={300}
          editable={!loading}
        />
        <TouchableOpacity
          style={[styles.sendBtn, hasInput && styles.sendBtnActive]}
          onPress={() => sendRef.current(input)}
          activeOpacity={0.78}
          disabled={!hasInput || loading}
        >
          <IcoSend active={hasInput} />
        </TouchableOpacity>
      </View>
      {/* Fondu HAUT — rendu en dernier → toujours au-dessus de la FlatList
          Positionné à top:headerH (base du header fixe) pour masquer le bord supérieur du scroll */}
      {headerH > 0 && (
        <View style={[styles.fadeTop, { top: headerH }]} pointerEvents="none">
          {Array.from({ length: 8 }, (_, i) => (
            <View key={i} style={{ flex: 1, backgroundColor: `rgba(20,21,42,${((7 - i) / 7) * 0.9})` }} />
          ))}
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },

  // En-tête
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: 16,
    paddingBottom:     10,
  },
  headerTitle: {
    color:         colors.accent,
    fontFamily:    fonts.ui,
    fontSize:      12,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  closeBtn: {
    width:           36,
    height:          36,
    borderRadius:    10,
    backgroundColor: 'rgba(255,255,255,.07)',
    alignItems:      'center',
    justifyContent:  'center',
  },
  mascotteSection: {
    alignItems:    'center',
    height:        112,   // imgH = 80*1.27 ≈ 102px + 10 marge
    // PAS d'overflow:hidden — l'anim peek entre par le bas, il faut la laisser passer
  },

  // Chat
  chatWrap: {
    flex: 1,
  },
  chat: {
    flex: 1,
  },
  chatContent: {
    paddingVertical:   16,
    paddingHorizontal: 0,
    paddingBottom:     56, // espace sous le dernier message avant le dégradé
  },
  // Fondu BAS — chevauche le bas de la FlatList vers la barre de saisie
  fadeBottom: {
    height:    72,
    marginTop: -72,
  },
  // Fondu HAUT — positionné absolument à la base du header fixe (top: headerH via inline style)
  fadeTop: {
    position: 'absolute',
    left:     0,
    right:    0,
    height:   28,
  },

  // Bulles bot
  rowBot: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom:  10,
  },
  bubbleBot: {
    maxWidth:         '82%',
    backgroundColor:  colors.surface,
    borderRadius:     radius.lg,
    borderTopLeftRadius: 4,
    paddingVertical:  11,
    paddingHorizontal: 14,
    borderWidth:      1,
    borderColor:      colors.border,
  },
  bubbleTxt: {
    color:      colors.white,
    fontFamily: fonts.body,
    fontSize:   13.5,
    lineHeight: 20,
  },

  // Bulles user
  rowUser: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    marginBottom:  10,
  },
  bubbleUser: {
    maxWidth:            '78%',
    backgroundColor:     colors.accent,
    borderRadius:        radius.lg,
    borderTopRightRadius: 4,
    paddingVertical:     10,
    paddingHorizontal:   14,
  },
  bubbleUserTxt: {
    color:      colors.bg,
    fontFamily: fonts.ui,
    fontSize:   13.5,
    lineHeight: 20,
  },

  // Chips de catégorie
  chipsScroll: {
    marginVertical: 4,
  },
  chipsContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  chip: {
    backgroundColor:  colors.surface,
    borderWidth:      1,
    borderColor:      colors.border,
    borderRadius:     radius.pill,
    paddingVertical:  8,
    paddingHorizontal: 14,
    flexDirection:    'row',
    alignItems:       'center',
    gap:              6,
  },
  chipImg:   { width: 24, height: 24, borderRadius: 5 },
  chipEmoji: { fontSize: 16 },
  chipTxt: {
    color:      colors.white,
    fontFamily: fonts.ui,
    fontSize:   13,
  },

  // Suggestions
  suggWrap: {
    marginHorizontal: 16,
    marginBottom:     10,
    borderRadius:     radius.md,
    overflow:         'hidden',
    borderWidth:      1,
    borderColor:      colors.border,
  },
  suggItem: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    paddingVertical:  12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor:   colors.surface,
  },
  suggTxt: {
    flex:       1,
    color:      '#D0D1E8',
    fontFamily: fonts.body,
    fontSize:   13,
    lineHeight: 18,
  },

  // Cartes shops
  shopsList: {
    paddingHorizontal: 16,
    marginBottom:      10,
    gap: 8,
  },
  shopCard: {
    flexDirection:    'row',
    alignItems:       'center',
    backgroundColor:  colors.surface,
    borderRadius:     radius.md,
    borderWidth:      1,
    borderColor:      colors.border,
    padding:          12,
    gap: 12,
  },
  shopLogo: {
    width:           46,
    height:          46,
    borderRadius:    12,
    backgroundColor: 'rgba(253,207,52,0.12)',
    borderWidth:     1,
    borderColor:     'rgba(253,207,52,0.25)',
    alignItems:      'center',
    justifyContent:  'center',
    overflow:        'hidden',
    flexShrink:      0,
  },
  shopLogoImg: {
    width: 46, height: 46,
  },
  shopLogoInitial: {
    color:      colors.accent,
    fontFamily: fonts.title,
    fontSize:   20,
  },
  shopInfo: {
    flex: 1,
    gap:  2,
  },
  shopNameRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap: 6,
  },
  shopName: {
    flex:       1,
    color:      colors.white,
    fontFamily: fonts.ui,
    fontSize:   14,
  },
  vipBadge: {
    fontSize:   11,
    color:      colors.accent,
    fontFamily: fonts.ui,
  },
  shopZone: {
    color:      colors.muted,
    fontFamily: fonts.body,
    fontSize:   12,
  },
  shopStatusRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap: 4,
    marginTop:     2,
  },
  statusDot: {
    width: 6, height: 6, borderRadius: 3,
  },
  statusTxt: {
    fontFamily: fonts.ui,
    fontSize:   11.5,
  },
  distTxt: {
    color:      colors.muted,
    fontFamily: fonts.body,
    fontSize:   11.5,
  },

  // Service client
  scBanner: {
    paddingHorizontal: 16,
    marginBottom:      10,
  },
  scBtn: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            9,
    backgroundColor: colors.accent,
    borderRadius:   radius.md,
    paddingVertical: 13,
  },
  scBtnTxt: {
    color:      colors.bg,
    fontFamily: fonts.ui,
    fontSize:   14,
  },

  // Barre de saisie
  inputBar: {
    flexDirection:    'row',
    alignItems:       'center',
    gap:              10,
    paddingHorizontal: 16,
    paddingVertical:   12,
    borderTopWidth:    1,
    borderTopColor:    colors.border,
    backgroundColor:   colors.bg,
  },
  input: {
    flex:             1,
    height:           44,
    backgroundColor:  colors.surface,
    borderWidth:      1,
    borderColor:      colors.border,
    borderRadius:     radius.pill,
    paddingHorizontal: 16,
    color:            colors.white,
    fontFamily:       fonts.body,
    fontSize:         14,
  },
  sendBtn: {
    width:           44,
    height:          44,
    borderRadius:    22,
    backgroundColor: colors.surface,
    borderWidth:     1,
    borderColor:     colors.border,
    alignItems:      'center',
    justifyContent:  'center',
  },
  sendBtnActive: {
    backgroundColor: colors.accent,
    borderColor:     colors.accent,
  },
});
