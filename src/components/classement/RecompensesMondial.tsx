import React from 'react';
import RecompensesAccordion, { RecompenseItem, ordinal } from './RecompensesAccordion';
import { PALIERS_MONDIAL, PalierRecompense } from '../../config/rewards';

const formatRang = ({ rangMin, rangMax }: PalierRecompense) =>
  rangMin === rangMax ? ordinal(rangMin) : `${ordinal(rangMin)} - ${ordinal(rangMax)}`;

const formatRecompenses = (p: PalierRecompense): string => {
  const items: string[] = [];
  if (p.creditLassi > 0) items.push(`${p.creditLassi} FCFA de crédit`);
  if (p.carrouselProduits > 0) {
    items.push(
      `${p.carrouselProduits} produit${p.carrouselProduits > 1 ? 's' : ''} dans Offre du Quartier`,
    );
  }
  if (p.prioriteRecherche) items.push('Priorité dans la recherche');
  if (p.notifVille) items.push('Notification à toute la ville');
  if (p.certificat) items.push('Certificat');
  if (p.newsletter) items.push('Mise en avant newsletter');
  return items.length > 0 ? items.join(' • ') : 'Badge sur le profil';
};

const items: RecompenseItem[] = PALIERS_MONDIAL.map(p => ({
  rang: formatRang(p),
  badge: p.badge,
  detail: formatRecompenses(p),
}));

// ─── Liste déroulante des récompenses du Top 40 mondial ──────────────────────

export default function RecompensesMondial() {
  return <RecompensesAccordion title="🎁 Récompenses du Top 40 National" items={items} />;
}
