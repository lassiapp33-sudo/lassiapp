import React, { useState } from 'react';
import { StatusBar } from 'react-native';
import useGerantStore from '../store/gerantStore';
import GerantLoginScreen from './screens/GerantLoginScreen';
import GerantDashboard from './screens/GerantDashboard';
import GerantRegistreScreen from './screens/GerantRegistreScreen';
import GerantHorairesScreen from './screens/GerantHorairesScreen';
import GerantMaisonScreen from './screens/GerantMaisonScreen';
import GerantChangeMdpScreen from './screens/GerantChangeMdpScreen';
import FicheVip from './FicheVip';

type GerantScreen =
  | 'login'
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
  const isActive = useGerantStore(s => s.isActive);
  const profil   = useGerantStore(s => s.profil);

  // Démarre sur login si aucune session gérant active, sinon sur le dashboard
  const [history, setHistory] = useState<GerantScreen[]>(
    isActive ? ['dashboard'] : ['login'],
  );

  const screen = history[history.length - 1];
  const push = (s: GerantScreen) => setHistory(h => [...h, s]);
  const pop  = () => setHistory(h => h.length > 1 ? h.slice(0, -1) : h);

  // ── Login ─────────────────────────────────────────────────────────────────
  if (screen === 'login') {
    return (
      <GerantLoginScreen
        onSuccess={() => setHistory(['dashboard'])}
      />
    );
  }

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
