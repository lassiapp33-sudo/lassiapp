import React from 'react';
import LivreurScreen from './LivreurScreen';

interface Props {
  onLogout: () => void;
}

export default function LivreurNavigator({ onLogout }: Props) {
  return <LivreurScreen onLogout={onLogout} />;
}
