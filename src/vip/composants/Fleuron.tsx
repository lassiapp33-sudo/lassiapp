import Svg, { Line, Path } from 'react-native-svg';
import { royal as r } from '../theme';

export const Fleuron = () => (
  <Svg width={120} height={14} viewBox="0 0 120 14" style={{ alignSelf: 'center', marginVertical: 22 }}>
    <Line x1={0} y1={7} x2={44} y2={7} stroke={r.couleur.filet} strokeWidth={1} />
    <Path d="M60 2 L65 7 L60 12 L55 7 Z" fill={r.couleur.or} />
    <Line x1={76} y1={7} x2={120} y2={7} stroke={r.couleur.filet} strokeWidth={1} />
  </Svg>
);
