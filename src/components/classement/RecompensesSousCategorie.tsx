import React from 'react';
import RecompensesAccordion, { RecompenseItem, ordinal } from './RecompensesAccordion';
import { RECOMPENSE_SOUS_CATEGORIE } from '../../config/rewards';

const { topVipRangs, dureeJours, badges } = RECOMPENSE_SOUS_CATEGORIE;

const items: RecompenseItem[] = topVipRangs.map(rang => ({
  rang: ordinal(rang),
  badge: badges[rang],
  detail: `Podium VIP pendant ${dureeJours} jours`,
}));

// ─── Liste déroulante des récompenses du Top 3 de la sous-catégorie ──────────

export default function RecompensesSousCategorie() {
  return <RecompensesAccordion title="🎁 Récompenses de la semaine" items={items} />;
}
