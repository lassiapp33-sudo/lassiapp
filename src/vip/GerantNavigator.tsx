import React, { useState } from 'react';
import useGerantStore from '../store/gerantStore';
import GerantDashboard from './screens/GerantDashboard';
import GerantRegistreScreen from './screens/GerantRegistreScreen';
import GerantHorairesScreen from './screens/GerantHorairesScreen';
import GerantMaisonScreen from './screens/GerantMaisonScreen';
import GerantChangeMdpScreen from './screens/GerantChangeMdpScreen';
import FicheVip from './FicheVip';

type GerantScreen =
  | 'dashboard'
  | 'registre'
  | 'horaires'
  | 'maison'
  | 'changeMdp'
  | { id: 'apercu'; shopId: string };

interface Props {
  onLogout: () => void;
}

export default function GerantNavigator({ onLogout }: Props) {
  const profil = useGerantStore(s => s.profil);

  const [history, setHistory] = useState<GerantScreen[]>(['dashboard']);

  const screen = history[history.length - 1];
  const push = (s: GerantScreen) => setHistory(h => [...h, s]);
  const pop  = () => setHistory(h => h.length > 1 ? h.slice(0, -1) : h);

  // ── Dashboard ─────────────────────────────────────────────────────────────
  if (screen === 'dashboard') {
    return (
      <GerantDashboard
        onNav={(id) => push(id)}
        onPreview={() => {
          if (profil?.shopId) push({ id: 'apercu', shopId: profil.shopId });
        }}
        onLogout={onLogout}
      />
    );
  }

  // ── Mon registre ─────────────────────────────────────────────────────────
  if (screen === 'registre') {
    return <GerantRegistreScreen onBack={pop} />;
  }

  // ── Mes heures ───────────────────────────────────────────────────────────
  if (screen === 'horaires') {
    return <GerantHorairesScreen onBack={pop} />;
  }

  // ── Ma maison ────────────────────────────────────────────────────────────
  if (screen === 'maison') {
    return (
      <GerantMaisonScreen
        onBack={pop}
        onPreview={() => {
          if (profil?.shopId) push({ id: 'apercu', shopId: profil.shopId });
        }}
      />
    );
  }

  // ── Mot de passe ─────────────────────────────────────────────────────────
  if (screen === 'changeMdp') {
    return <GerantChangeMdpScreen onBack={pop} />;
  }

  // ── Aperçu fiche client ──────────────────────────────────────────────────
  if (typeof screen === 'object' && screen.id === 'apercu') {
    return (
      <FicheVip
        shopId={screen.shopId}
        onBack={pop}
        onChat={() => {}}
      />
    );
  }

  // Fallback (ne devrait jamais arriver)
  return null;
}
