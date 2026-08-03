import React, { useEffect, useState } from 'react';
import useGerantStore from '../store/gerantStore';
import useShopStore from '../store/shopStore';
import GerantDashboard from './screens/GerantDashboard';
import GerantRegistreScreen from './screens/GerantRegistreScreen';
import GerantHorairesScreen from './screens/GerantHorairesScreen';
import GerantMaisonScreen from './screens/GerantMaisonScreen';
import GerantChangeMdpScreen from './screens/GerantChangeMdpScreen';
import GerantProfilScreen from './screens/GerantProfilScreen';
import FicheVip from './FicheVip';
import AlaUneScreen from '../screens/merchant/AlaUneScreen';
import MerchantAvisScreen from '../screens/merchant/MerchantAvisScreen';
import ClassementScreen from '../screens/classement/ClassementScreen';
import MerchantLivraisonScreen from '../screens/merchant/MerchantLivraisonScreen';
import MapScreen from '../screens/home/MapScreen';
import VisibilityScreen from '../screens/merchant/VisibilityScreen';
import MaCampagneScreen from '../screens/merchant/MaCampagneScreen';
import RevenueScreen from '../screens/merchant/RevenueScreen';
import MerchantPaymentsScreen from '../screens/merchant/MerchantPaymentsScreen';
import OffreQuartierScreen from '../screens/merchant/OffreQuartierScreen';
import GerantReservationsTableScreen from './screens/GerantReservationsTableScreen';
import GerantScanArriveeScreen from './screens/GerantScanArriveeScreen';
import GerantEspacesScreen from './screens/GerantEspacesScreen';
import GerantCreneauxScreen from './screens/GerantCreneauxScreen';
import GerantRdvBeautyScreen from './screens/GerantRdvBeautyScreen';
import GerantCreneauxBeautyScreen from './screens/GerantCreneauxBeautyScreen';

type GerantScreen =
  | 'dashboard'
  | 'profil'
  | 'registre'
  | 'horaires'
  | 'maison'
  | 'changeMdp'
  | 'alaune'
  | 'avis'
  | 'classement'
  | 'livraison'
  | 'autourDeMoi'
  | 'visibilite'
  | 'campagne'
  | 'revenus'
  | 'encaissements'
  | 'offreQuartier'
  | 'reservations_table'
  | 'scan_arrivee'
  | 'espaces_config'
  | 'creneaux_config'
  | 'rdv_beauty'
  | 'creneaux_beauty'
  | { id: 'apercu'; shopId: string };

interface Props {
  onLogout: () => void;
}

export default function GerantNavigator({ onLogout }: Props) {
  const profil = useGerantStore(s => s.profil);
  const shopId = useShopStore(s => s.shopId);
  const loadMyShop = useShopStore(s => s.loadMyShop);

  // Hydrate shopStore so screens shared with merchant (avis, alaune, classement…) work for VIP gérants
  useEffect(() => {
    if (!shopId) loadMyShop();
  }, [shopId, loadMyShop]);

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

  // ── Profil ───────────────────────────────────────────────────────────────
  if (screen === 'profil') {
    return (
      <GerantProfilScreen
        onBack={pop}
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

  // ── À la une ─────────────────────────────────────────────────────────────
  if (screen === 'alaune') {
    return <AlaUneScreen onBack={pop} />;
  }

  // ── Mes avis ─────────────────────────────────────────────────────────────
  if (screen === 'avis') {
    return <MerchantAvisScreen onBack={pop} />;
  }

  // ── Classement ───────────────────────────────────────────────────────────
  if (screen === 'classement') {
    return <ClassementScreen variant="prestataire" onBack={pop} />;
  }

  // ── Livraison ────────────────────────────────────────────────────────────
  if (screen === 'livraison') {
    return <MerchantLivraisonScreen onBack={pop} />;
  }

  // ── Autour de moi ────────────────────────────────────────────────────────
  if (screen === 'autourDeMoi') {
    return (
      <MapScreen
        onBack={pop}
        excludeShopId={profil?.shopId ?? undefined}
      />
    );
  }

  // ── Visibilité ───────────────────────────────────────────────────────────
  if (screen === 'visibilite') {
    return <VisibilityScreen onBack={pop} />;
  }

  // ── Ma Campagne ──────────────────────────────────────────────────────────
  if (screen === 'campagne') {
    return <MaCampagneScreen onBack={pop} />;
  }

  // ── Mes revenus ──────────────────────────────────────────────────────────
  if (screen === 'revenus') {
    return <RevenueScreen onBack={pop} />;
  }

  // ── Mes encaissements ────────────────────────────────────────────────────
  if (screen === 'encaissements') {
    return <MerchantPaymentsScreen onBack={pop} />;
  }

  // ── Offre du Quartier ────────────────────────────────────────────────────
  if (screen === 'offreQuartier') {
    return <OffreQuartierScreen onBack={pop} />;
  }

  // ── Réservations de table ────────────────────────────────────────────────
  if (screen === 'reservations_table') {
    return (
      <GerantReservationsTableScreen
        onBack={pop}
        onScanQR={() => push('scan_arrivee')}
      />
    );
  }

  // ── Scanner arrivée ──────────────────────────────────────────────────────
  if (screen === 'scan_arrivee') {
    return <GerantScanArriveeScreen onBack={pop} />;
  }

  // ── Mes espaces (config) ─────────────────────────────────────────────────
  if (screen === 'espaces_config') {
    return <GerantEspacesScreen onBack={pop} />;
  }

  // ── Mes créneaux (config) ────────────────────────────────────────────────
  if (screen === 'creneaux_config') {
    return <GerantCreneauxScreen onBack={pop} />;
  }

  // ── Mes RDV beauté ───────────────────────────────────────────────────────
  if (screen === 'rdv_beauty') {
    return <GerantRdvBeautyScreen onBack={pop} />;
  }

  // ── Créneaux beauté (config) ──────────────────────────────────────────────
  if (screen === 'creneaux_beauty') {
    return <GerantCreneauxBeautyScreen onBack={pop} />;
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
