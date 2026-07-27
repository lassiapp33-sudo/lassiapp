import React, { useState } from 'react';
import LivreurScreen from './LivreurScreen';
import LivreurShopNavigator from './LivreurShopNavigator';

interface Props {
  onLogout: () => void;
}

export default function LivreurNavigator({ onLogout }: Props) {
  const [shopping, setShopping] = useState(false);

  if (shopping) {
    return <LivreurShopNavigator onBack={() => setShopping(false)} />;
  }

  return <LivreurScreen onLogout={onLogout} onShop={() => setShopping(true)} />;
}
