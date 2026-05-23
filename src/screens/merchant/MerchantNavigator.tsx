import React, { useState } from 'react';
import MerchantDashboard    from './MerchantDashboard';
import MerchantProfileScreen from './MerchantProfileScreen';
import DebtsScreen          from './DebtsScreen';
import StoreScreen          from './StoreScreen';
import OrdersScreen         from './OrdersScreen';
import VisibilityScreen     from './VisibilityScreen';

// Navigateur du cockpit prestataire — tous les modules sont câblés ici.
type MerchantScreen = 'dashboard' | 'debts' | 'store' | 'orders' | 'visibility' | 'profile';

interface Props { onLogout: () => void; }

export default function MerchantNavigator({ onLogout }: Props) {
  const [screen, setScreen] = useState<MerchantScreen>('dashboard');

  if (screen === 'debts')      return <DebtsScreen      onBack={() => setScreen('dashboard')} />;
  if (screen === 'store')      return <StoreScreen       onBack={() => setScreen('dashboard')} />;
  if (screen === 'orders')     return <OrdersScreen      onBack={() => setScreen('dashboard')} />;
  if (screen === 'visibility') return <VisibilityScreen  onBack={() => setScreen('dashboard')} />;
  if (screen === 'profile')    return (
    <MerchantProfileScreen
      onStore={()      => setScreen('store')}
      onVisibility={() => setScreen('visibility')}
      onLogout={onLogout}
    />
  );

  return (
    <MerchantDashboard
      onNavigate={(dest) => {
        if (dest === 'debts')      setScreen('debts');
        if (dest === 'store')      setScreen('store');
        if (dest === 'orders')     setScreen('orders');
        if (dest === 'visibility') setScreen('visibility');
        if (dest === 'profile')    setScreen('profile');
      }}
    />
  );
}
