import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { fonts } from '../../theme';

interface Props {
  label: string;
}

export default function DaySeparator({ label }: Props) {
  return <Text style={styles.txt}>{label}</Text>;
}

const styles = StyleSheet.create({
  txt: {
    textAlign: 'center',
    color: '#5a5c80',
    fontFamily: fonts.body,
    fontSize: 11,
    marginVertical: 4,
  },
});
