import React from 'react';
import Svg, { Path, Circle, Rect, Ellipse } from 'react-native-svg';

const IC = '#FDCF34';
const IF = '#FDCF3440';

// ─── Récompenses ─────────────────────────────────────────────────────────────

export const IcoCrown = ({ size = 28 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M3 18h18v2H3z" fill={IC}/>
    <Path d="M3 14l4-6 5 3.5 5-3.5 4 6z" fill={IC} stroke={IC} strokeWidth={1} strokeLinejoin="round"/>
    <Circle cx="3" cy="8" r="1.5" fill={IC}/>
    <Circle cx="12" cy="5" r="1.5" fill={IC}/>
    <Circle cx="21" cy="8" r="1.5" fill={IC}/>
  </Svg>
);

export const IcoTrophy = ({ size = 28 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M12 15c-4 0-7-3.1-7-7V4h14v4c0 3.9-3 7-7 7z" fill={IF} stroke={IC} strokeWidth={1.5}/>
    <Path d="M5 6H2v1.5C2 9.4 3.3 11 5 11.5" stroke={IC} strokeWidth={1.5} strokeLinecap="round" fill="none"/>
    <Path d="M19 6h3v1.5C22 9.4 20.7 11 19 11.5" stroke={IC} strokeWidth={1.5} strokeLinecap="round" fill="none"/>
    <Path d="M12 15v3" stroke={IC} strokeWidth={1.5} strokeLinecap="round"/>
    <Path d="M8 21h8" stroke={IC} strokeWidth={1.5} strokeLinecap="round"/>
    <Rect x="9" y="18" width="6" height="2" rx="0.5" fill={IC}/>
  </Svg>
);

export const IcoMedaille = ({ size = 28 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Circle cx="12" cy="14" r="7" fill={IF} stroke={IC} strokeWidth={1.5}/>
    <Path d="M9 5l3-3 3 3-3 2z" fill={IC} stroke={IC} strokeWidth={1} strokeLinejoin="round"/>
    <Path d="M9 5h6l1 4H8z" fill={IF} stroke={IC} strokeWidth={1}/>
    <Path d="M12 11v3l1.5 1" stroke={IC} strokeWidth={1.2} strokeLinecap="round"/>
  </Svg>
);

// ─── Visages notation ─────────────────────────────────────────────────────────

export const IcoFaceHappy = ({ size = 48 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Circle cx="12" cy="12" r="10" fill={IF} stroke={IC} strokeWidth={1.5}/>
    <Circle cx="8.5" cy="10" r="1.2" fill={IC}/>
    <Circle cx="15.5" cy="10" r="1.2" fill={IC}/>
    <Path d="M8 14.5s1.5 3 4 3 4-3 4-3" stroke={IC} strokeWidth={1.5} strokeLinecap="round" fill="none"/>
  </Svg>
);

export const IcoFaceSad = ({ size = 48 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Circle cx="12" cy="12" r="10" fill={IF} stroke={IC} strokeWidth={1.5}/>
    <Path d="M7.5 9.5l2 1.5M16.5 9.5l-2 1.5" stroke={IC} strokeWidth={1.5} strokeLinecap="round"/>
    <Circle cx="8.5" cy="11" r="1" fill={IC}/>
    <Circle cx="15.5" cy="11" r="1" fill={IC}/>
    <Path d="M8.5 17s1.5-2.5 3.5-2.5 3.5 2.5 3.5 2.5" stroke={IC} strokeWidth={1.5} strokeLinecap="round" fill="none"/>
  </Svg>
);

// ─── Nourriture & Restaurant ──────────────────────────────────────────────────

export const IcoPlate = ({ size = 64 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Ellipse cx="12" cy="14" rx="9" ry="5" fill={IF} stroke={IC} strokeWidth={1.5}/>
    <Path d="M8 14c0-2.2 1.8-4 4-4s4 1.8 4 4" stroke={IC} strokeWidth={1.5} fill="none"/>
    <Path d="M9 6v5" stroke={IC} strokeWidth={1.5} strokeLinecap="round"/>
    <Path d="M7.5 5.5c0 0-.5 2 .5 3" stroke={IC} strokeWidth={1.2} strokeLinecap="round" fill="none"/>
    <Path d="M10.5 5.5c0 0 .5 2-.5 3" stroke={IC} strokeWidth={1.2} strokeLinecap="round" fill="none"/>
    <Path d="M15 4v7" stroke={IC} strokeWidth={1.5} strokeLinecap="round"/>
    <Path d="M13 5v2a2 2 0 0 0 2 2 2 2 0 0 0 2-2V5" stroke={IC} strokeWidth={1.2} fill="none" strokeLinecap="round"/>
  </Svg>
);

// ─── Célébration ──────────────────────────────────────────────────────────────

export const IcoCelebration = ({ size = 64 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M5 19l4-4 9-9-5-5-9 9z" fill={IF} stroke={IC} strokeWidth={1.5} strokeLinejoin="round"/>
    <Circle cx="17" cy="4" r="1.2" fill={IC}/>
    <Circle cx="20" cy="8" r="1" fill={IC}/>
    <Circle cx="19" cy="12" r="0.9" fill={IC}/>
    <Circle cx="21" cy="5" r="0.7" fill={IC}/>
    <Path d="M9.5 15.5l8-8" stroke={IC} strokeWidth={1.5} strokeLinecap="round"/>
  </Svg>
);

export const IcoCheckCircle = ({ size = 56 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Circle cx="12" cy="12" r="10" fill={IF} stroke={IC} strokeWidth={1.5}/>
    <Path d="M7 12.5l3.5 3.5 6.5-7" stroke={IC} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none"/>
  </Svg>
);

// ─── Caméra ───────────────────────────────────────────────────────────────────

export const IcoCameraLarge = ({ size = 56 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Rect x="2" y="7" width="20" height="15" rx="2" fill={IF} stroke={IC} strokeWidth={1.5}/>
    <Path d="M9 4h6l2 3H7z" stroke={IC} strokeWidth={1.3} fill="none" strokeLinejoin="round"/>
    <Circle cx="12" cy="14" r="4" stroke={IC} strokeWidth={1.5} fill="none"/>
    <Circle cx="12" cy="14" r="1.5" fill={IC}/>
    <Circle cx="18" cy="10" r="1" fill={IC}/>
  </Svg>
);

// ─── Commerce ────────────────────────────────────────────────────────────────

export const IcoStore = ({ size = 64 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M3 9l9-7 9 7" stroke={IC} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    <Rect x="2" y="9" width="20" height="13" rx="1" fill={IF} stroke={IC} strokeWidth={1.5}/>
    <Rect x="9" y="14" width="6" height="8" rx="0.5" stroke={IC} strokeWidth={1.2} fill="none"/>
    <Rect x="3.5" y="12" width="4" height="4" rx="0.5" stroke={IC} strokeWidth={1} fill="none"/>
    <Rect x="16.5" y="12" width="4" height="4" rx="0.5" stroke={IC} strokeWidth={1} fill="none"/>
    <Path d="M2 9h20v3H2z" fill={IC} opacity={0.2}/>
  </Svg>
);

// ─── Livraison ────────────────────────────────────────────────────────────────

export const IcoTruck = ({ size = 64 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Rect x="1" y="7" width="15" height="11" rx="1" fill={IF} stroke={IC} strokeWidth={1.5}/>
    <Path d="M16 10h4l3 4v4h-7z" fill={IF} stroke={IC} strokeWidth={1.5} strokeLinejoin="round"/>
    <Circle cx="5.5" cy="18.5" r="2" fill={IC}/>
    <Circle cx="18.5" cy="18.5" r="2" fill={IC}/>
    <Path d="M4 12h6M4 15h4" stroke={IC} strokeWidth={1.2} strokeLinecap="round"/>
  </Svg>
);

// ─── Chat ─────────────────────────────────────────────────────────────────────

export const IcoChat = ({ size = 32 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" fill={IF} stroke={IC} strokeWidth={1.5} strokeLinejoin="round"/>
    <Path d="M8 9h8M8 13h5" stroke={IC} strokeWidth={1.3} strokeLinecap="round"/>
  </Svg>
);

// ─── Cadeau ───────────────────────────────────────────────────────────────────

export const IcoGift = ({ size = 64 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Rect x="2" y="11" width="20" height="12" rx="1" fill={IF} stroke={IC} strokeWidth={1.5}/>
    <Rect x="3" y="7" width="18" height="4" rx="1" stroke={IC} strokeWidth={1.5} fill={IC} opacity={0.3}/>
    <Path d="M12 7V23" stroke={IC} strokeWidth={1.5}/>
    <Path d="M12 7c0 0-3-4 0-5.5S15 4 12 7z" fill={IC} stroke={IC} strokeWidth={1} strokeLinejoin="round"/>
    <Path d="M12 7c0 0 3-4 0-5.5S9 4 12 7z" fill={IC} stroke={IC} strokeWidth={1} strokeLinejoin="round"/>
    <Path d="M2 11h20" stroke={IC} strokeWidth={1}/>
  </Svg>
);

// ─── Panier / Commerce ────────────────────────────────────────────────────────

export const IcoCart = ({ size = 32, color = IC }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" fill={color + '40'} stroke={color} strokeWidth={1.5} strokeLinejoin="round"/>
    <Path d="M3 6h18" stroke={color} strokeWidth={1.5}/>
    <Path d="M16 10a4 4 0 0 1-8 0" stroke={color} strokeWidth={1.5} strokeLinecap="round" fill="none"/>
  </Svg>
);

// ─── Quartier / Maison ────────────────────────────────────────────────────────

export const IcoNeighborhood = ({ size = 32 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M1 11l5-5 5 5" stroke={IC} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    <Rect x="2" y="11" width="8" height="10" rx="0.5" fill={IF} stroke={IC} strokeWidth={1.5}/>
    <Path d="M9 10l6-6 6 6" stroke={IC} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    <Rect x="10" y="10" width="10" height="11" rx="0.5" fill={IF} stroke={IC} strokeWidth={1.5}/>
    <Rect x="12" y="14" width="3" height="4" rx="0.3" stroke={IC} strokeWidth={1} fill="none"/>
    <Rect x="5" y="14" width="2.5" height="2.5" rx="0.3" stroke={IC} strokeWidth={1} fill="none"/>
  </Svg>
);

// ─── Salut / Main ─────────────────────────────────────────────────────────────

export const IcoWave = ({ size = 48 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M9 11V4.5a1.5 1.5 0 0 1 3 0V10" stroke={IC} strokeWidth={1.5} strokeLinecap="round" fill="none"/>
    <Path d="M12 10V3.5a1.5 1.5 0 0 1 3 0V10" stroke={IC} strokeWidth={1.5} strokeLinecap="round" fill="none"/>
    <Path d="M15 9.5V5a1.5 1.5 0 0 1 3 0v5.5" stroke={IC} strokeWidth={1.5} strokeLinecap="round" fill="none"/>
    <Path d="M9 11.5V10a1.5 1.5 0 0 0-3 0v4c0 4 2 7 6 7s7-3.5 7-7v-3a1.5 1.5 0 0 0-3 0" stroke={IC} strokeWidth={1.5} strokeLinecap="round" fill={IF}/>
  </Svg>
);

// ─── Éclair ───────────────────────────────────────────────────────────────────

export const IcoLightning = ({ size = 22 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M13 2L4.5 13.5H11L11 22l8.5-11.5H13z" fill={IF} stroke={IC} strokeWidth={1.5} strokeLinejoin="round"/>
  </Svg>
);

// ─── Sports ───────────────────────────────────────────────────────────────────

export const IcoFootball = ({ size = 18 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Circle cx="12" cy="12" r="10" fill={IF} stroke={IC} strokeWidth={1.5}/>
    <Path d="M12 6l3 2.5-1 4-2 .5-2-.5-1-4z" fill={IC} opacity={0.7}/>
    <Path d="M12 6l-4-1M12 6l4-1M15 8.5l3.5 1.5M9 8.5L5.5 10M11 13l-3 4M13 13l3 4" stroke={IC} strokeWidth={1} strokeLinecap="round"/>
  </Svg>
);

export const IcoBasketball = ({ size = 18 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Circle cx="12" cy="12" r="10" fill={IF} stroke={IC} strokeWidth={1.5}/>
    <Path d="M2 12h20M12 2v20" stroke={IC} strokeWidth={1.3}/>
    <Path d="M4.9 5a8 8 0 0 1 6 6M4.9 19a8 8 0 0 0 6-6M19.1 5a8 8 0 0 0-6 6M19.1 19a8 8 0 0 1-6-6" stroke={IC} strokeWidth={1.2} fill="none"/>
  </Svg>
);

export const IcoTennis = ({ size = 18 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Circle cx="12" cy="12" r="10" fill={IF} stroke={IC} strokeWidth={1.5}/>
    <Path d="M4.5 7.5C7 9 9 12 9 12s-2 3-4.5 4.5M19.5 7.5C17 9 15 12 15 12s2 3 4.5 4.5" stroke={IC} strokeWidth={1.3} fill="none" strokeLinecap="round"/>
  </Svg>
);

export const IcoVolleyball = ({ size = 18 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Circle cx="12" cy="12" r="10" fill={IF} stroke={IC} strokeWidth={1.5}/>
    <Path d="M12 2a10 10 0 0 1 8.7 5M12 2a10 10 0 0 0-8.7 5" stroke={IC} strokeWidth={1.3} fill="none"/>
    <Path d="M3.3 7C5 11 9 12 12 12M20.7 7C19 11 15 12 12 12" stroke={IC} strokeWidth={1.3} fill="none"/>
    <Path d="M12 12c0 5-3 8-5.5 9.5M12 12c0 5 3 8 5.5 9.5" stroke={IC} strokeWidth={1.3} fill="none"/>
  </Svg>
);

export const IcoStadium = ({ size = 18 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Ellipse cx="12" cy="10" rx="10" ry="5" fill={IF} stroke={IC} strokeWidth={1.5}/>
    <Path d="M2 10v4c0 2.8 4.5 5 10 5s10-2.2 10-5v-4" stroke={IC} strokeWidth={1.5} fill="none"/>
    <Ellipse cx="12" cy="10" rx="5" ry="2.5" stroke={IC} strokeWidth={1.2} fill={IC} opacity={0.2}/>
    <Path d="M2 10c0 2.8 4.5 5 10 5s10-2.2 10-5" stroke={IC} strokeWidth={1} fill="none"/>
  </Svg>
);

// ─── Statuts paiement ─────────────────────────────────────────────────────────

export const IcoStatusOk = ({ size = 18, color = '#4DC78A' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Circle cx="12" cy="12" r="10" fill={`${color}20`} stroke={color} strokeWidth={1.5}/>
    <Path d="M7 12.5l3.5 3.5 6.5-7" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none"/>
  </Svg>
);

export const IcoStatusFail = ({ size = 18, color = '#F5655B' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Circle cx="12" cy="12" r="10" fill={`${color}20`} stroke={color} strokeWidth={1.5}/>
    <Path d="M8 8l8 8M16 8l-8 8" stroke={color} strokeWidth={2} strokeLinecap="round"/>
  </Svg>
);

export const IcoStatusLoading = ({ size = 18, color = '#5BB8F5' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Circle cx="12" cy="12" r="10" fill={`${color}20`} stroke={color} strokeWidth={1.5} strokeDasharray="4 2"/>
    <Path d="M12 7v5l3 2" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" fill="none"/>
  </Svg>
);

export const IcoStatusMoney = ({ size = 18, color = '#FDCF34' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Circle cx="12" cy="12" r="10" fill={`${color}20`} stroke={color} strokeWidth={1.5}/>
    <Path d="M12 6v1m0 10v1m-4-6h1m6 0h1" stroke={color} strokeWidth={1.3} strokeLinecap="round"/>
    <Path d="M9.5 10.5c0-1 1.1-1.5 2.5-1.5s2.5.5 2.5 1.5c0 2.5-5 2-5 4.5 0 1 1.1 1.5 2.5 1.5s2.5-.5 2.5-1.5" stroke={color} strokeWidth={1.3} strokeLinecap="round" fill="none"/>
  </Svg>
);

export const IcoStatusReturn = ({ size = 18, color = '#F5A55B' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Circle cx="12" cy="12" r="10" fill={`${color}20`} stroke={color} strokeWidth={1.5}/>
    <Path d="M9 9H6V6M6 9a6 6 0 1 0 1.7-4.3" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none"/>
  </Svg>
);

export const IcoStatusQuestion = ({ size = 18, color = '#9CA3AF' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Circle cx="12" cy="12" r="10" fill={`${color}20`} stroke={color} strokeWidth={1.5}/>
    <Path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 2-2.5 2.5-2.5 4.5" stroke={color} strokeWidth={1.5} strokeLinecap="round" fill="none"/>
    <Circle cx="12" cy="18" r="1" fill={color}/>
  </Svg>
);

export const IcoStatusSim = ({ size = 18, color = '#B07BF5' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Circle cx="12" cy="12" r="10" fill={`${color}20`} stroke={color} strokeWidth={1.5}/>
    <Path d="M9 8h2l1 4 1.5-6 1.5 4h2" stroke={color} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    <Path d="M7 16h10" stroke={color} strokeWidth={1.2} strokeLinecap="round"/>
  </Svg>
);

// ─── Notifications ────────────────────────────────────────────────────────────

export const IcoNotifGift = ({ size = 40 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Rect x="2" y="10" width="20" height="12" rx="1" fill={IF} stroke={IC} strokeWidth={1.5}/>
    <Rect x="3" y="6.5" width="18" height="3.5" rx="0.5" fill={IC} opacity={0.4} stroke={IC} strokeWidth={1}/>
    <Path d="M12 6.5V22" stroke={IC} strokeWidth={1.5}/>
    <Path d="M12 6.5c0 0-3-4.5 0-5.5 2 1 0 5.5 0 5.5z" fill={IC}/>
    <Path d="M12 6.5c0 0 3-4.5 0-5.5-2 1 0 5.5 0 5.5z" fill={IC}/>
  </Svg>
);

export const IcoNotifOrder = ({ size = 40 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" fill={IF} stroke={IC} strokeWidth={1.5} strokeLinejoin="round"/>
    <Path d="M3 6h18" stroke={IC} strokeWidth={1.5}/>
    <Path d="M16 10a4 4 0 0 1-8 0" stroke={IC} strokeWidth={1.5} strokeLinecap="round" fill="none"/>
  </Svg>
);

export const IcoNotifAnn = ({ size = 40 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M3 11h3v6H3z" fill={IF} stroke={IC} strokeWidth={1.5} strokeLinejoin="round"/>
    <Path d="M6 11L18 4v16L6 13z" fill={IF} stroke={IC} strokeWidth={1.5} strokeLinejoin="round"/>
    <Path d="M6 17v3a2 2 0 0 0 4 0v-3" stroke={IC} strokeWidth={1.5} strokeLinecap="round" fill="none"/>
  </Svg>
);

export const IcoNotifMsg = ({ size = 40 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" fill={IF} stroke={IC} strokeWidth={1.5} strokeLinejoin="round"/>
    <Path d="M8 9h8M8 13h5" stroke={IC} strokeWidth={1.3} strokeLinecap="round"/>
  </Svg>
);

export const IcoNotifLivraison = ({ size = 40 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Rect x="1" y="7" width="14" height="11" rx="1" fill={IF} stroke={IC} strokeWidth={1.5}/>
    <Path d="M15 10h4l3 4v4h-7z" fill={IF} stroke={IC} strokeWidth={1.5} strokeLinejoin="round"/>
    <Circle cx="5.5" cy="18.5" r="2" fill={IC}/>
    <Circle cx="18.5" cy="18.5" r="2" fill={IC}/>
  </Svg>
);

export const IcoNotifPay = ({ size = 40 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Rect x="2" y="6" width="20" height="14" rx="2" fill={IF} stroke={IC} strokeWidth={1.5}/>
    <Path d="M2 10h20" stroke={IC} strokeWidth={1.5}/>
    <Circle cx="7" cy="15" r="2" fill={IC}/>
    <Rect x="12" y="13.5" width="7" height="3" rx="1" fill={IC} opacity={0.5}/>
  </Svg>
);

export const IcoNotifFitness = ({ size = 40 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    {/* Barre centrale */}
    <Rect x="7.5" y="11" width="9" height="2" rx="1" fill={IC}/>
    {/* Poids gauche */}
    <Rect x="1.5" y="8" width="3" height="8" rx="1.5" fill={IF} stroke={IC} strokeWidth={1.5}/>
    {/* Manchon gauche */}
    <Rect x="4.5" y="9.5" width="3" height="5" rx="0.5" fill={IC} opacity={0.6}/>
    {/* Poids droit */}
    <Rect x="19.5" y="8" width="3" height="8" rx="1.5" fill={IF} stroke={IC} strokeWidth={1.5}/>
    {/* Manchon droit */}
    <Rect x="16.5" y="9.5" width="3" height="5" rx="0.5" fill={IC} opacity={0.6}/>
  </Svg>
);
