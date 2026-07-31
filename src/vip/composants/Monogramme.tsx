import Svg, { Circle, Path, Text as SvgText, Line } from 'react-native-svg';
import { royal as r } from '../theme';

export function Monogramme({ initiale, taille = 120 }: { initiale: string; taille?: number }) {
  return (
    <Svg width={taille} height={taille} viewBox="0 0 140 140">
      <Circle cx={70} cy={70} r={52} fill="none" stroke={r.couleur.or} strokeWidth={1} />
      <Circle cx={70} cy={70} r={45} fill="none" stroke="rgba(200,164,58,0.4)" strokeWidth={0.8} />
      <Path d="M70 18 C96 34 96 106 70 122 C44 106 44 34 70 18 Z"
            fill="none" stroke="rgba(200,164,58,0.4)" strokeWidth={0.8} />
      <SvgText x={70} y={86} textAnchor="middle" fontFamily="Marcellus_400Regular"
               fontSize={44} fill={r.couleur.orClair}>{initiale}</SvgText>
      <Path d="M70 6 l2.6 5.4 5.9.8 -4.3 4.1 1 5.9 -5.2-2.8 -5.2 2.8 1-5.9 -4.3-4.1 5.9-.8 Z"
            fill={r.couleur.or} />
      <Line x1={34} y1={126} x2={106} y2={126} stroke={r.couleur.or} strokeWidth={1} />
    </Svg>
  );
}
