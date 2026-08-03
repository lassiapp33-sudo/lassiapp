import React, { useEffect, useRef, useCallback } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors, fonts, radius, TOP_INSET } from '../../theme';
import { IcoStore } from './LassiIcons';
import { Annonce } from '../../hooks/useAnnonces';

const AUTO_MS = 8000;

interface Props {
  annonce: Annonce;
  onDismiss: () => void;
  onVoirVitrine: () => void;
}

export default function NouveauPrestataireBanner({ annonce, onDismiss, onVoirVitrine }: Props) {
  const slideY   = useRef(new Animated.Value(-200)).current;
  const progress = useRef(new Animated.Value(1)).current;
  const anims    = useRef<{ slideIn?: Animated.CompositeAnimation; timer?: Animated.CompositeAnimation }>({});
  const exitingRef = useRef(false);

  const slideOut = useCallback(
    (done?: () => void) => {
      if (exitingRef.current) return;
      exitingRef.current = true;
      anims.current.slideIn?.stop();
      anims.current.timer?.stop();
      Animated.timing(slideY, {
        toValue: -200,
        duration: 260,
        useNativeDriver: true,
      }).start(() => {
        onDismiss();
        exitingRef.current = false;
        done?.();
      });
    },
    [onDismiss, slideY],
  );

  useEffect(() => {
    exitingRef.current = false;
    progress.setValue(1);
    slideY.setValue(-200);

    const slideIn = Animated.timing(slideY, {
      toValue: 0,
      duration: 340,
      useNativeDriver: true,
    });
    anims.current.slideIn = slideIn;

    slideIn.start(({ finished }) => {
      if (!finished) return;
      const t = Animated.timing(progress, {
        toValue: 0,
        duration: AUTO_MS,
        useNativeDriver: false,
      });
      anims.current.timer = t;
      t.start(({ finished: f }) => { if (f) slideOut(); });
    });

    return () => {
      anims.current.slideIn?.stop();
      anims.current.timer?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [annonce.id]);

  return (
    <Animated.View style={[s.wrap, { transform: [{ translateY: slideY }] }]}>
      <View style={s.row}>
        {/* Icône */}
        <View style={s.iconBox}>
          <IcoStore size={28} />
        </View>

        {/* Texte */}
        <View style={s.txt}>
          <Text style={s.title} numberOfLines={1}>{annonce.titre.replace(/\s*!+\s*$/g, '')}</Text>
          <Text style={s.body}  numberOfLines={2}>{annonce.corps}</Text>
        </View>

        {/* Fermer */}
        <TouchableOpacity
          style={s.closeBtn}
          onPress={() => slideOut()}
          hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
          activeOpacity={0.7}
        >
          <Text style={s.closeTxt}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Bouton Voir la vitrine */}
      <TouchableOpacity
        style={s.cta}
        onPress={() => slideOut(onVoirVitrine)}
        activeOpacity={0.85}
      >
        <Text style={s.ctaTxt}>Voir la vitrine</Text>
      </TouchableOpacity>

      {/* Barre de progression */}
      <Animated.View
        style={[
          s.bar,
          {
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
    position:      'absolute',
    top:           TOP_INSET + 4,
    left:          12,
    right:         12,
    zIndex:        9999,
    elevation:     20,
    borderRadius:  radius.lg,
    overflow:      'hidden',
    borderWidth:   1,
    borderColor:   colors.accent,
    backgroundColor: colors.surface,
    shadowColor:   '#000',
    shadowOffset:  { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius:  10,
  },
  row: {
    flexDirection: 'row',
    alignItems:    'center',
    padding:       12,
    gap:           10,
  },
  iconBox: {
    width:           42,
    height:          42,
    borderRadius:    radius.sm,
    backgroundColor: 'rgba(253,207,52,.13)',
    alignItems:      'center',
    justifyContent:  'center',
    flexShrink:      0,
  },
  txt:   { flex: 1 },
  title: {
    color:      colors.white,
    fontFamily: fonts.title,
    fontSize:   13,
  },
  body: {
    color:      colors.muted,
    fontFamily: fonts.body,
    fontSize:   11,
    marginTop:  2,
    lineHeight: 15,
  },
  closeBtn: {
    paddingRight: 4,
    paddingLeft:  4,
    alignSelf:    'stretch',
    alignItems:   'center',
    justifyContent: 'center',
  },
  closeTxt: {
    color:      colors.muted,
    fontSize:   15,
    fontFamily: fonts.ui,
  },
  cta: {
    marginHorizontal: 12,
    marginBottom:     10,
    height:           38,
    borderRadius:     radius.md,
    backgroundColor:  colors.accent,
    alignItems:       'center',
    justifyContent:   'center',
  },
  ctaTxt: {
    color:      colors.bg,
    fontFamily: fonts.titleXL,
    fontSize:   13,
  },
  bar: {
    height:          3,
    backgroundColor: colors.accent,
  },
});
