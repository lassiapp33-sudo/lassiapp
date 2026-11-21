import React, { useRef, useState, useEffect } from 'react';
import { Modal, Pressable, StyleSheet, TouchableOpacity, View, FlatList, useWindowDimensions } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../../theme';

const IcoClose = () => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" strokeWidth={2.2} strokeLinecap="round">
    <Path d="M6 6l12 12M18 6L6 18" stroke="#fff" />
  </Svg>
);

interface Props {
  /** URL simple (legacy) OU tableau d'URLs (carrousel). null/undefined = fermée. */
  uri?: string | null;
  uris?: string[] | null;
  /** Index de départ dans uris. */
  startIndex?: number;
  onClose: () => void;
}

/**
 * Affiche une ou plusieurs images en plein écran (contentFit contain, swipe horizontal).
 */
export default function ImageZoomModal({ uri, uris, startIndex = 0, onClose }: Props) {
  const { width } = useWindowDimensions();
  const list = (uris && uris.length > 0 ? uris : uri ? [uri] : []).filter(Boolean) as string[];
  const open = list.length > 0;
  const [idx, setIdx] = useState(startIndex);
  const ref = useRef<FlatList<string>>(null);

  useEffect(() => {
    if (open) setIdx(Math.min(startIndex, list.length - 1));
  }, [open, startIndex, list.length]);

  return (
    <Modal
      visible={open}
      transparent
      presentationStyle="overFullScreen"
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.8}>
          <IcoClose />
        </TouchableOpacity>
        {open ? (
          <FlatList
            ref={ref}
            data={list}
            keyExtractor={(u, i) => `${i}-${u}`}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={Math.min(startIndex, list.length - 1)}
            getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
            onMomentumScrollEnd={e => setIdx(Math.round(e.nativeEvent.contentOffset.x / width))}
            renderItem={({ item }) => (
              <Pressable style={[styles.page, { width }]} onPress={onClose}>
                <ExpoImage source={{ uri: item }} style={styles.img} contentFit="contain" transition={120} />
              </Pressable>
            )}
          />
        ) : null}
        {list.length > 1 && (
          <View style={styles.dots}>
            {list.map((_, i) => (
              <View key={i} style={[styles.dot, i === idx && styles.dotOn]} />
            ))}
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(6,7,18,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  page: { height: '100%', alignItems: 'center', justifyContent: 'center' },
  img: { width: '100%', height: '100%' },
  closeBtn: {
    position: 'absolute',
    top: 48,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(20,21,42,0.85)',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  dots: {
    position: 'absolute',
    bottom: 48,
    flexDirection: 'row',
    gap: 6,
    alignSelf: 'center',
  },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.35)' },
  dotOn: { backgroundColor: '#fff', width: 18 },
});
