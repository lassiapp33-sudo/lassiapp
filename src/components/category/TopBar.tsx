import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, StatusBar } from 'react-native';
import { colors, fonts, radius } from '../../theme';
import { IcoBack, IcoSearch } from '../icons';

interface Props {
  title:    string;
  onBack:   () => void;
  onSearch?: () => void;
}

const TOP = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) + 10 : 46;

export default function TopBar({ title, onBack, onSearch }: Props) {
  return (
    <View style={[styles.bar, { paddingTop: TOP }]}>
      <TouchableOpacity style={styles.btn} onPress={onBack} activeOpacity={0.7}>
        <IcoBack />
      </TouchableOpacity>

      <Text style={styles.title} numberOfLines={1}>{title}</Text>

      <TouchableOpacity style={styles.btn} onPress={onSearch} activeOpacity={0.7}>
        <IcoSearch />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: colors.bg,
  },
  btn: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  title: {
    flex: 1,
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 19,
  },
});
