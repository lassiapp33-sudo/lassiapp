import Svg, { Path, Text as SvgText } from 'react-native-svg';
import { royal as r } from '../theme';

export function Blason({ initiale, taille = 86 }: { initiale: string; taille?: number }) {
  return (
    <Svg width={taille} height={taille} viewBox="0 0 100 100">
      <Path d="M50 6 L86 20 V52 C86 74 68 88 50 94 C32 88 14 74 14 52 V20 Z"
            fill="none" stroke={r.couleur.or} strokeWidth={1.1} />
      <Path d="M50 12 L80 24 V52 C80 70 65 83 50 88 C35 83 20 70 20 52 V24 Z"
            fill="none" stroke={r.couleur.or} strokeWidth={1.1} opacity={0.45} />
      <Path d="M31 58 C24 48 26 36 33 31" fill="none" stroke={r.couleur.or} strokeWidth={1.1} opacity={0.7} />
      <Path d="M69 58 C76 48 74 36 67 31" fill="none" stroke={r.couleur.or} strokeWidth={1.1} opacity={0.7} />
      <SvgText x={50} y={59} textAnchor="middle" fontFamily="Cinzel_500Medium"
               fontSize={30} fill={r.couleur.orClair}>{initiale}</SvgText>
      <Path d="M44 70 h12" stroke={r.couleur.or} strokeWidth={1.1} />
    </Svg>
  );
}
