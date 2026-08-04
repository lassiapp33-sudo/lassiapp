import React from 'react';
import { Text, StyleSheet } from 'react-native';

export default function VipBadge() {
  return <Text style={styles.crown}>👑</Text>;
}

const styles = StyleSheet.create({
  crown: {
    fontSize: 16,
    lineHeight: 20,
  },
});
