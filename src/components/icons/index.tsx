import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';
import { colors } from '../../theme';

interface IconProps {
  color?: string;
  size?: number;
}

export const IcoBack = ({ color = colors.white, size = 20 }: IconProps) => (
  <Svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Path d="M19 12H5" stroke={color} />
    <Path d="M12 19l-7-7 7-7" stroke={color} />
  </Svg>
);

export const IcoClose = ({ color = colors.white, size = 18 }: IconProps) => (
  <Svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth={2.2}
    strokeLinecap="round"
  >
    <Path d="M18 6 6 18M6 6l12 12" stroke={color} />
  </Svg>
);

export const IcoPlus = ({ color = colors.accent, size = 18 }: IconProps) => (
  <Svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth={2.2}
    strokeLinecap="round"
  >
    <Path d="M12 5v14M5 12h14" stroke={color} />
  </Svg>
);

export const IcoCartAdd = ({ color = colors.bg, size = 16 }: IconProps) => (
  <Svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" stroke={color} />
    <Path d="M3 6h18" stroke={color} />
    <Path d="M12 11v6M9 14h6" stroke={color} />
  </Svg>
);

export const IcoSearch = ({ color = colors.muted, size = 18 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" strokeWidth={2}>
    <Circle cx={11} cy={11} r={8} stroke={color} />
    <Path d="m21 21-4.3-4.3" stroke={color} />
  </Svg>
);

export const IcoPlay = ({ color = colors.muted, size = 15 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M8 5v14l11-7z" />
  </Svg>
);

export const IcoStop = ({ color = colors.accent, size = 13 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M6 6h12v12H6z" />
  </Svg>
);

export const IcoChevron = ({ color = colors.muted, size = 16 }: IconProps) => (
  <Svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Path d="m6 9 6 6 6-6" stroke={color} />
  </Svg>
);
