import React from 'react';
import { StyleProp, ImageStyle } from 'react-native';
import { Image } from 'expo-image';

// Logo officiel LASSI — PNG transparent (658×211px)
// Ne pas modifier ce fichier ni l'image source
const SOURCE = require('../../assets/logo.png');
const RATIO = 658 / 211;

interface Props {
  width?: number;
  style?: StyleProp<ImageStyle>;
}

const LassiLogo = React.memo(function LassiLogo({ width = 220, style }: Props) {
  return (
    <Image
      source={SOURCE}
      style={[{ width, height: width / RATIO }, style]}
      contentFit="contain"
      cachePolicy="disk"
      transition={0}
    />
  );
});

export default LassiLogo;
