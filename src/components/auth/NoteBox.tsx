import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { fonts } from '../../theme';

interface Props {
  text: string;
  style?: ViewStyle;
}

export default function NoteBox({ text, style }: Props) {
  return (
    <View style={[styles.box, style]}>
      <Svg
        width={17}
        height={17}
        viewBox="0 0 24 24"
        fill="none"
        strokeWidth={1.8}
        strokeLinecap="round"
        style={{ marginTop: 1 }}
      >
        <Circle cx={12} cy={12} r={10} stroke="#FDCF34" />
        <Path d="M12 16v-4" stroke="#FDCF34" />
        <Path d="M12 8h.01" stroke="#FDCF34" />
      </Svg>
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    gap: 9,
    alignItems: 'flex-start',
    backgroundColor: 'rgba(253, 207, 52, 0.07)',
    borderWidth: 1,
    borderColor: 'rgba(253, 207, 52, 0.20)',
    borderRadius: 13,
    padding: 12,
    paddingHorizontal: 13,
  },
  text: {
    flex: 1,
    color: '#c9b06a',
    fontFamily: fonts.body,
    fontSize: 11.5,
    lineHeight: 17,
  },
});
