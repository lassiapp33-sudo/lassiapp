/**
 * config/categories.ts — Source unique de vérité pour toutes les catégories LASSI.
 * Utilisé par : inscription marchand, CatNavBar, CategoryGrid, CategoryScreen, filtres.
 */

import React from 'react';
import Svg, { Path, Circle, Rect } from 'react-native-svg';

const IMG_TANGANA = require('../../assets/tangana.png');
const IMG_NDEKI = require('../../assets/ndeki.png');
const IMG_SOUPE = require('../../assets/soupe.png');
const IMG_JUS = require('../../assets/jus.png');
const IMG_SNACK = require('../../assets/snack.png');
const IMG_COIFFEUR_HOMME = require('../../assets/coiffeur_homme.png');
const IMG_FRUITS_MARINES = require('../../assets/fruits_marines.png');

export type CatId = 'stores' | 'tangana' | 'food' | 'hair' | 'sport' | 'bakery' | 'fruiterie';

export type ShopType = 'products' | 'services' | 'memberships';

export interface SubcatOption {
  id: string;
  emoji: string;
  label: string;
  desc: string;
  imageUri?: number;
}

export interface CatConfig {
  id: CatId;
  label: string;
  subLabel: string;
  emoji: string;
  shopType: ShopType;
  /** Mode de sélection à l'inscription : 'single' = radio, 'multiple' = cases */
  subcatMode: 'single' | 'multiple';
  subcats: SubcatOption[];
  /** Icône SVG vectorielle — couleur et taille paramétrables */
  renderIcon: (color: string, size?: number) => React.ReactNode;
}

export const CATEGORIES: CatConfig[] = [
  {
    id: 'stores',
    label: 'Commerçants',
    subLabel: 'Commerçant',
    emoji: '🏪',
    shopType: 'products',
    subcatMode: 'multiple',
    subcats: [
      {
        id: 'alimentation',
        emoji: '🛒',
        label: 'Alimentation / Boutique',
        desc: 'Épicerie, mini-marché',
      },
      {
        id: 'quincaillerie',
        emoji: '🔧',
        label: 'Quincaillerie',
        desc: 'Outils, matériaux, bricolage',
      },
    ],
    renderIcon: (color, size = 24) =>
      React.createElement(
        Svg,
        {
          width: size,
          height: size,
          viewBox: '0 0 24 24',
          fill: 'none',
          strokeWidth: 1.7,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        },
        React.createElement(Path, { d: 'M3 9l1-5h16l1 5', stroke: color }),
        React.createElement(Path, { d: 'M4 9v11a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9', stroke: color }),
        React.createElement(Path, { d: 'M3 9h18', stroke: color }),
        React.createElement(Path, { d: 'M9 22V12h6v10', stroke: color }),
      ),
  },
  {
    id: 'tangana',
    label: 'Tangana / Ndéki / Soupe',
    subLabel: 'Tangana',
    emoji: '☕',
    shopType: 'products',
    subcatMode: 'single',
    subcats: [
      {
        id: 'tangana',
        emoji: '☕',
        label: 'Tangana',
        desc: 'Petit-déjeuner, café Touba, thé, pain',
        imageUri: IMG_TANGANA,
      },
      {
        id: 'ndeki',
        emoji: '🍲',
        label: 'Ndéki (Mama)',
        desc: 'Repas du midi, plats cuisinés',
        imageUri: IMG_NDEKI,
      },
      {
        id: 'soupe',
        emoji: '🥣',
        label: 'Soupe',
        desc: 'Soupes, potages, bouillons maison',
        imageUri: IMG_SOUPE,
      },
    ],
    renderIcon: (color, size = 24) =>
      React.createElement(
        Svg,
        {
          width: size,
          height: size,
          viewBox: '0 0 24 24',
          fill: 'none',
          strokeWidth: 1.7,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        },
        React.createElement(Path, { d: 'M18 8h1a4 4 0 0 1 0 8h-1', stroke: color }),
        React.createElement(Path, { d: 'M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4Z', stroke: color }),
        React.createElement(Path, { d: 'M6 2v2M10 2v2M14 2v2', stroke: color }),
      ),
  },
  {
    id: 'bakery',
    label: 'Boulangeries',
    subLabel: 'Boulangerie',
    emoji: '🥖',
    shopType: 'products',
    subcatMode: 'multiple',
    subcats: [
      { id: 'boulangerie', emoji: '🥖', label: 'Boulangerie', desc: 'Pain, baguettes, sandwichs' },
      {
        id: 'patisserie',
        emoji: '🍰',
        label: 'Pâtisserie',
        desc: 'Gâteaux, tartes, viennoiseries',
      },
    ],
    renderIcon: (color, size = 24) =>
      React.createElement(
        Svg,
        {
          width: size,
          height: size,
          viewBox: '0 0 24 24',
          fill: 'none',
          strokeWidth: 1.7,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        },
        React.createElement(Path, {
          d: 'M6 9h12a4 4 0 0 1 4 4v4a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-4a4 4 0 0 1 4-4Z',
          stroke: color,
        }),
        React.createElement(Path, { d: 'M12 9V5M8 9V6M16 9V6', stroke: color }),
      ),
  },
  {
    id: 'food',
    label: 'Restos & Boissons',
    subLabel: 'Restaurant',
    emoji: '🍽',
    shopType: 'products',
    subcatMode: 'multiple',
    subcats: [
      {
        id: 'restaurant',
        emoji: '🍽️',
        label: 'Restaurant',
        desc: 'Plats complets, sur place / à emporter',
      },
      { id: 'fastfood', emoji: '🍔', label: 'Fast-food', desc: 'Burgers, shawarma, sandwichs' },
      { id: 'dibiterie', emoji: '🥩', label: 'Dibiterie', desc: 'Viande grillée, thiébou guinar' },
      { id: 'seras', emoji: '🔥', label: 'Séraas', desc: 'Poisson braisé, fruits de mer' },
      {
        id: 'jus',
        emoji: '🧃',
        label: 'Jus & Boissons',
        desc: 'Bissap, bouye, jus frais',
        imageUri: IMG_JUS,
      },
      {
        id: 'snack',
        emoji: '🍰',
        label: 'Snack & Pâtisserie',
        desc: 'Gâteaux, viennoiseries, snacks',
        imageUri: IMG_SNACK,
      },
    ],
    renderIcon: (color, size = 24) =>
      React.createElement(
        Svg,
        {
          width: size,
          height: size,
          viewBox: '0 0 24 24',
          fill: 'none',
          strokeWidth: 1.7,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        },
        React.createElement(Path, {
          d: 'M3 2v7c0 1.1.9 2 2 2a2 2 0 0 0 2-2V2M5 2v9M9 2v20',
          stroke: color,
        }),
        React.createElement(Path, { d: 'M17 2c-1.7 0-3 1.3-3 3v6h3m0-9v20', stroke: color }),
      ),
  },
  {
    id: 'fruiterie',
    label: 'Fruiterie',
    subLabel: 'Fruiterie',
    emoji: '🍓',
    shopType: 'products',
    subcatMode: 'multiple',
    subcats: [
      { id: 'fruits', emoji: '🍎', label: 'Fruits frais', desc: 'Fruits frais de saison' },
      {
        id: 'fruits_marines',
        emoji: '🍓',
        label: 'Fruits marinés',
        desc: 'Fruits marinés, préparés',
        imageUri: IMG_FRUITS_MARINES,
      },
    ],
    renderIcon: (color, size = 24) =>
      React.createElement(
        Svg,
        {
          width: size,
          height: size,
          viewBox: '0 0 24 24',
          fill: 'none',
          strokeWidth: 1.7,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        },
        React.createElement(Circle, { cx: 7, cy: 17, r: 3.5, stroke: color }),
        React.createElement(Circle, { cx: 17, cy: 17, r: 3.5, stroke: color }),
        React.createElement(Path, { d: 'M7 13.5C7 9 10 6 12 5s5 4 5 8.5', stroke: color }),
        React.createElement(Path, { d: 'M12 5c0-3 4-2 3 0', stroke: color }),
      ),
  },
  {
    id: 'hair',
    label: 'Coiffeurs & Salons',
    subLabel: 'Salon',
    emoji: '💈',
    shopType: 'services',
    subcatMode: 'multiple',
    subcats: [
      {
        id: 'hommes',
        emoji: '💈',
        label: 'Hommes',
        desc: 'Coupe, barbe, soins homme',
        imageUri: IMG_COIFFEUR_HOMME,
      },
      { id: 'femmes', emoji: '💇‍♀️', label: 'Femmes', desc: 'Tresses, tissage, soins, brushing' },
      {
        id: 'esthetique',
        emoji: '💅',
        label: 'Esthétique & Ongles',
        desc: 'Manucure, pose, soins beauté',
      },
    ],
    renderIcon: (color, size = 24) =>
      React.createElement(
        Svg,
        {
          width: size,
          height: size,
          viewBox: '0 0 24 24',
          fill: 'none',
          strokeWidth: 1.7,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        },
        React.createElement(Path, {
          d: 'M6 2l1 6M6 8c-2 0-3 2-3 4s1 9 1 9M18 2l-1 6M18 8c2 0 3 2 3 4s-1 9-1 9',
          stroke: color,
        }),
        React.createElement(Circle, { cx: 12, cy: 6, r: 3, stroke: color }),
      ),
  },
  {
    id: 'sport',
    label: 'Salles de sport',
    subLabel: 'Salle',
    emoji: '🏋',
    shopType: 'memberships',
    subcatMode: 'multiple',
    subcats: [
      {
        id: 'musculation',
        emoji: '🏋',
        label: 'Musculation / Fitness',
        desc: 'Salle de musculation, cardio',
      },
      { id: 'arts_martiaux', emoji: '🥊', label: 'Arts martiaux', desc: 'Boxe, judo, taekwondo…' },
      { id: 'collectifs', emoji: '🤸', label: 'Cours collectifs', desc: 'Yoga, danse, aérobic' },
    ],
    renderIcon: (color, size = 24) =>
      React.createElement(
        Svg,
        {
          width: size,
          height: size,
          viewBox: '0 0 24 24',
          fill: 'none',
          strokeWidth: 1.7,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        },
        React.createElement(Path, {
          d: 'M6.5 6.5 17.5 17.5M3 8l2-2M19 16l2-2M8 3l2 2M14 19l2 2M6.5 6.5 5 8M17.5 17.5 19 16',
          stroke: color,
        }),
        React.createElement(Rect, {
          x: 2,
          y: 9,
          width: 4,
          height: 6,
          rx: 1,
          transform: 'rotate(45 4 12)',
          stroke: color,
        }),
      ),
  },
];

/** Retourne la config d'une catégorie par son id. */
export function getCatConfig(catId: CatId): CatConfig | undefined {
  return CATEGORIES.find(c => c.id === catId);
}

/** Dérive le shop_type depuis la catégorie (fallback 'products'). */
export function shopTypeFromCategory(catId: string): ShopType {
  return getCatConfig(catId as CatId)?.shopType ?? 'products';
}

/** Labels des sous-catégories actives pour l'affichage (filtre). */
export function getActiveSubs(catId: CatId): SubcatOption[] {
  return getCatConfig(catId)?.subcats ?? [];
}

/** Toutes les sous-catégories d'une catégorie (par id string, sans cast). */
export function getSubcategories(catId: string): SubcatOption[] {
  return CATEGORIES.find(c => c.id === catId)?.subcats ?? [];
}

/** Une sous-catégorie précise. */
export function getSubcategory(catId: string, subId: string): SubcatOption | undefined {
  return getSubcategories(catId).find(s => s.id === subId);
}
