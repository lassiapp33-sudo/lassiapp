import React from 'react';
import { Image, StyleProp, ImageStyle } from 'react-native';

// Logo officiel LASSI — PNG transparent (350×114px)
// Ne pas modifier ce fichier ni l'image source
const SOURCE = require('../../assets/logo.png');
const RATIO  = 350 / 114;

interface Props {
  width?: number;
  style?: StyleProp<ImageStyle>;
}

export default function LassiLogo({ width = 220, style }: Props) {
  return (
    <Image
      source={SOURCE}
      style={[{ width, height: width / RATIO }, style]}
      resizeMode="contain"
    />
  );
}
