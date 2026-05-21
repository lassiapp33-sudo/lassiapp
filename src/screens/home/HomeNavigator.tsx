import React, { useState } from 'react';
import ClientHomeScreen           from './ClientHomeScreen';
import CategoryScreen             from '../category/CategoryScreen';
import { CatId }                  from '../../components/category/CatNavBar';

type HomeStack =
  | { id: 'main' }
  | { id: 'category'; catId: CatId; title: string };

export default function HomeNavigator() {
  const [stack, setStack] = useState<HomeStack>({ id: 'main' });

  if (stack.id === 'category') {
    return (
      <CategoryScreen
        initialCatId={stack.catId}
        onBack={() => setStack({ id: 'main' })}
      />
    );
  }

  return (
    <ClientHomeScreen
      onCategoryPress={(catId, title) => setStack({ id: 'category', catId, title })}
    />
  );
}
