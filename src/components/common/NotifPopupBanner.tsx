import React, { useEffect, useRef, useCallback } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors, fonts, radius, TOP_INSET } from '../../theme';
import { NotifType } from '../../store/notificationsStore';
import useNotifPopupStore from '../../store/notifPopupStore';

const EMOJI: Record<NotifType, string> = {
  order: '🛍️',
  pay: '✅',
  vip: '🎁',
  msg: '💬',
  ann: '📢',
};

const COLOR: Record<NotifType, string> = {
  order: colors.accent,
  pay: colors.success,
  vip: colors.orange,
  msg: colors.accent,
  ann: colors.accent,
};

const BG: Record<NotifType, string> = {
  order: 'rgba(253,207,52,.13)',
  pay: 'rgba(95,211,138,.13)',
  vip: 'rgba(240,168,71,.13)',
  msg: 'rgba(253,207,52,.13)',
  ann: 'rgba(253,207,52,.13)',
};

const AUTO_MS = 5000;

interface Props {
  onView: () => void;
}

// Bannière style PUBG : slide depuis le haut, auto-dismiss 5 s.
// Chaque notification n'apparaît qu'une seule fois (tracké par ID via AsyncStorage).
export default function NotifPopupBanner({ onView }: Props) {
  const current = useNotifPopupStore(s => s.queue[0] ?? null);
  const dismiss  = useNotifPopupStore(s => s.dismiss);

  const slideY   = useRef(new Animated.Value(-160)).current;
  const progress = useRef(new Animated.Value(1)).current;

  // On stocke TOUTES les animations en cours pour pouvoir les stopper
  const anims = useRef<{
    slideIn?: Animated.CompositeAnimation;
    timer?:   Animated.CompositeAnimation;
  }>({});
  const exitingRef = useRef(false);

  const slideOut = useCallback(
    (done?: () => void) => {
      if (exitingRef.current) return;
      exitingRef.current = true;
      // Annule le slide-in s'il est encore en cours, puis le timer
      anims.current.slideIn?.stop();
      anims.current.timer?.stop();
      const anim = Animated.timing(slideY, {
        toValue: -160,
        duration: 260,
        useNativeDriver: true,
      });
      anim.start(() => {
        dismiss();
        exitingRef.current = false;
        done?.();
      });
    },
    [dismiss, slideY],
  );

  useEffect(() => {
    if (!current) return;

    exitingRef.current = false;
    progress.setValue(1);
    slideY.setValue(-160);

    const slideIn = Animated.timing(slideY, {
      toValue: 0,
      duration: 340,
      useNativeDriver: true,
    });
    anims.current.slideIn = slideIn;

    slideIn.start(({ finished }) => {
      if (!finished) return;           // annulé → pas de timer
      const t = Animated.timing(progress, {
        toValue: 0,
        duration: AUTO_MS,
        useNativeDriver: false,        // width% ne peut pas passer sur le thread natif
      });
      anims.current.timer = t;
      t.start(({ finished: f }) => {
        if (f) slideOut();
      });
    });

    return () => {
      anims.current.slideIn?.stop();
      anims.current.timer?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  if (!current) return null;

  const color = COLOR[current.type];
  const bg    = BG[current.type];

  return (
    <Animated.View style={[s.wrap, { transform: [{ translateY: slideY }] }]}>
      <View style={s.row}>
        {/* Zone principale → ouvre l'écran Notifications */}
        <TouchableOpacity
          style={s.pressArea}
          onPress={() => slideOut(onView)}
          activeOpacity={0.82}
        >
          <View style={[s.iconBox, { backgroundColor: bg }]}>
            <Text style={s.emoji}>{EMOJI[current.type]}</Text>
          </View>
          <View style={s.txt}>
            <Text style={s.title} numberOfLines={1}>{current.title}</Text>
            <Text style={s.body}  numberOfLines={2}>{current.body}</Text>
          </View>
        </TouchableOpacity>

        {/* Bouton fermer */}
        <TouchableOpacity
          style={s.closeBtn}
          onPress={() => slideOut()}
          hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
          activeOpacity={0.7}
        >
          <Text style={s.closeTxt}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Barre de progression qui se vide en 5 s */}
      <Animated.View
        style={[
          s.bar,
          {
            backgroundColor: color,
            width: progress.interpolate({
              inputRange:  [0, 1],
              outputRange: ['0%', '100%'],
            }),
          },
        ]}
      />
    </Animated.View>
  );
}

const s = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top:    TOP_INSET + 4,
    left:   12,
    right:  12,
    zIndex: 9999,
    elevation: 20,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.accent,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  pressArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 10,
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  emoji: { fontSize: 20 },
  txt:   { flex: 1 },
  title: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 13,
  },
  body: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  closeBtn: {
    paddingRight: 14,
    paddingLeft: 4,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeTxt: {
    color: colors.muted,
    fontSize: 15,
    fontFamily: fonts.ui,
  },
  bar: { height: 3 },
});
