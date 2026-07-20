/**
 * config/categories.ts — Source unique de vérité pour toutes les catégories LASSI.
 * Utilisé par : inscription marchand, CatNavBar, CategoryGrid, CategoryScreen, filtres.
 */

import React from 'react';
import Svg, { Path, Circle, Rect, Ellipse } from 'react-native-svg';

const IMG_SOUPE = require('../../assets/soupe.png');
const IMG_JUS = require('../../assets/jus.png');
const IMG_SNACK = require('../../assets/snack.png');

// Reproduction vectorielle de coiffeur_homme.png — homme qui se coiffe
const IcoCoiffeurHomme: React.FC<{ color: string }> = () =>
  React.createElement(
    Svg,
    { width: 36, height: 36, viewBox: '0 0 56 56' },
    // Corps / t-shirt bleu
    React.createElement(Path, {
      d: 'M 8 56 L 8 42 C 8 38 14 36 24 36 C 34 36 40 38 40 42 L 40 56 Z',
      fill: '#3A7AC8',
    }),
    // Cou
    React.createElement(Rect, { x: 20, y: 33, width: 8, height: 6, rx: 3, fill: '#F5C898' }),
    // Tête
    React.createElement(Circle, { cx: 24, cy: 22, r: 14, fill: '#F5C898' }),
    // Cheveux bruns (calotte)
    React.createElement(Path, {
      d: 'M 10 19 C 10 8 15 6 24 6 C 33 6 38 8 38 19 C 36 13 31 11 24 11 C 17 11 12 13 10 19 Z',
      fill: '#7B4A2A',
    }),
    // Oreille droite (côté bras levé)
    React.createElement(Ellipse, { cx: 38, cy: 22, rx: 3, ry: 3.5, fill: '#E8B080' }),
    // Oeil gauche
    React.createElement(Circle, { cx: 19, cy: 21, r: 2, fill: '#1A0A04' }),
    React.createElement(Circle, { cx: 19.8, cy: 20.2, r: 0.7, fill: '#FFF' }),
    // Oeil droit
    React.createElement(Circle, { cx: 29, cy: 21, r: 2, fill: '#1A0A04' }),
    React.createElement(Circle, { cx: 29.8, cy: 20.2, r: 0.7, fill: '#FFF' }),
    // Nez
    React.createElement(Circle, { cx: 24, cy: 26, r: 1.5, fill: '#E0A070' }),
    // Sourire
    React.createElement(Path, {
      d: 'M 20 30 Q 24 34 28 30',
      stroke: '#C08050',
      strokeWidth: 1.8,
      fill: 'none',
      strokeLinecap: 'round',
    }),
    // Bras droit levé — coude puis avant-bras vers le haut de la tête
    React.createElement(Path, {
      d: 'M 39 40 C 46 34 50 24 46 10',
      stroke: '#F5C898',
      strokeWidth: 6,
      fill: 'none',
      strokeLinecap: 'round',
    }),
    // Main (petit cercle au bout du bras)
    React.createElement(Circle, { cx: 46, cy: 9, r: 4, fill: '#F5C898' }),
    // Peigne — corps rectangulaire
    React.createElement(Rect, { x: 42, y: 1, width: 13, height: 6, rx: 2, fill: '#1A1A1A' }),
    // Dents du peigne (6 dents)
    React.createElement(Path, {
      d: 'M 44 7 L 44 11 M 46.5 7 L 46.5 11 M 49 7 L 49 11 M 51.5 7 L 51.5 11',
      stroke: '#1A1A1A',
      strokeWidth: 1.5,
      strokeLinecap: 'round',
    }),
    // Ligne de coupe dans les cheveux (effet peigne passant)
    React.createElement(Path, {
      d: 'M 28 8 C 33 7 38 8 42 10',
      stroke: '#F5C898',
      strokeWidth: 1.5,
      fill: 'none',
      strokeLinecap: 'round',
      opacity: 0.7,
    }),
  );

// Reproduction vectorielle de tangana.png — baguette de pain avec incisions
const IcoTangana: React.FC<{ color: string }> = () =>
  React.createElement(
    Svg,
    { width: 36, height: 36, viewBox: '0 0 36 36' },
    // Ombre portée
    React.createElement(Ellipse, { cx: 18, cy: 28, rx: 13, ry: 2, fill: '#9A5E10', opacity: 0.25 }),
    // Corps de la baguette (allongé, bombé)
    React.createElement(Path, {
      d: 'M 5 20 C 4 13 8 10 18 10 C 28 10 32 13 31 20 C 32 27 28 26 18 26 C 8 26 4 27 5 20 Z',
      fill: '#D4922A',
    }),
    // Croûte du dessous (plus foncée)
    React.createElement(Path, {
      d: 'M 6 23 C 6 26 10 26 18 26 C 26 26 30 26 30 23',
      stroke: '#A86820',
      strokeWidth: 3.5,
      fill: 'none',
      strokeLinecap: 'round',
    }),
    // 3 incisions diagonales caractéristiques
    React.createElement(Path, { d: 'M 10 13 L 8 22', stroke: '#7A4A0C', strokeWidth: 1.8, strokeLinecap: 'round', opacity: 0.8 }),
    React.createElement(Path, { d: 'M 18 12 L 16 22', stroke: '#7A4A0C', strokeWidth: 1.8, strokeLinecap: 'round', opacity: 0.8 }),
    React.createElement(Path, { d: 'M 26 13 L 24 22', stroke: '#7A4A0C', strokeWidth: 1.8, strokeLinecap: 'round', opacity: 0.8 }),
    // Reflet doré sur le dessus
    React.createElement(Path, {
      d: 'M 8 14 C 13 11 23 11 28 14',
      stroke: '#F0C050',
      strokeWidth: 1.5,
      fill: 'none',
      strokeLinecap: 'round',
      opacity: 0.65,
    }),
  );

// Reproduction vectorielle de ndeki.png — sandwich / petit pain garni
const IcoNdeki: React.FC<{ color: string }> = () =>
  React.createElement(
    Svg,
    { width: 36, height: 36, viewBox: '0 0 36 36' },
    // Pain du bas
    React.createElement(Path, {
      d: 'M 5 22 C 5 18 8 17 18 17 C 28 17 31 18 31 22 C 31 27 28 29 18 29 C 8 29 5 27 5 22 Z',
      fill: '#C88020',
    }),
    // Garniture viande (couche épaisse rouge-brun)
    React.createElement(Path, {
      d: 'M 6 19 C 7 15 10 14 18 14 C 26 14 29 15 30 19',
      stroke: '#8B2A0E',
      strokeWidth: 5,
      fill: 'none',
      strokeLinecap: 'round',
    }),
    // Légumes verts sur la garniture
    React.createElement(Path, {
      d: 'M 10 17 L 13 15 M 17 15 L 20 14 M 24 16 L 26 17',
      stroke: '#3A8020',
      strokeWidth: 1.8,
      strokeLinecap: 'round',
    }),
    // Chapeau du pain (demi-oval bombé)
    React.createElement(Path, {
      d: 'M 6 16 C 5 9 9 7 18 7 C 27 7 31 9 30 16 C 29 18 26 17 18 17 C 10 17 7 18 6 16 Z',
      fill: '#D4A030',
    }),
    // Reflet brillant sur le chapeau
    React.createElement(Path, {
      d: 'M 9 10 C 13 8 23 8 27 10',
      stroke: '#F0C858',
      strokeWidth: 1.5,
      fill: 'none',
      strokeLinecap: 'round',
      opacity: 0.7,
    }),
    // Graines de sésame
    React.createElement(Ellipse, { cx: 15, cy: 11, rx: 1.2, ry: 0.7, fill: '#F0C858' }),
    React.createElement(Ellipse, { cx: 18, cy: 10, rx: 1.2, ry: 0.7, fill: '#F0C858' }),
    React.createElement(Ellipse, { cx: 21, cy: 11, rx: 1.2, ry: 0.7, fill: '#F0C858' }),
  );

// Reproduction vectorielle de malibu.jpg — poisson braisé entier avec marques de grill
const IcoMalibu: React.FC<{ color: string }> = () =>
  React.createElement(
    Svg,
    { width: 36, height: 36, viewBox: '0 0 64 48' },
    // Corps principal — forme de poisson allongée, doré-brun grillé
    React.createElement(Path, {
      d: 'M 10 24 C 10 14 18 9 32 9 C 46 9 55 15 55 24 C 55 33 46 39 32 39 C 18 39 10 34 10 24 Z',
      fill: '#C87028',
    }),
    // Ventre clair
    React.createElement(Path, {
      d: 'M 12 28 C 14 36 22 40 32 39 C 42 38 52 34 54 28',
      stroke: '#E8943C',
      strokeWidth: 5,
      fill: 'none',
      strokeLinecap: 'round',
    }),
    // Queue fourchue (bien visible)
    React.createElement(Path, {
      d: 'M 55 24 L 64 13 L 59 24 L 64 35 Z',
      fill: '#8A3A10',
    }),
    // Nageoire dorsale (dessus)
    React.createElement(Path, {
      d: 'M 22 9 C 30 1 46 1 50 9',
      stroke: '#9A4818',
      strokeWidth: 3,
      fill: 'none',
      strokeLinecap: 'round',
    }),
    // Zone tête (plus sombre)
    React.createElement(Path, {
      d: 'M 10 24 C 10 14 16 9 24 10 C 18 14 16 19 16 24 C 16 29 18 34 24 38 C 16 39 10 34 10 24 Z',
      fill: '#7A3010',
    }),
    // 3 marques de grill diagonales (caractéristique du braisé)
    React.createElement(Path, {
      d: 'M 32 11 L 27 37',
      stroke: '#3A1004',
      strokeWidth: 3,
      strokeLinecap: 'round',
      opacity: 0.8,
    }),
    React.createElement(Path, {
      d: 'M 41 10 L 36 38',
      stroke: '#3A1004',
      strokeWidth: 3,
      strokeLinecap: 'round',
      opacity: 0.8,
    }),
    React.createElement(Path, {
      d: 'M 50 13 L 45 37',
      stroke: '#3A1004',
      strokeWidth: 3,
      strokeLinecap: 'round',
      opacity: 0.8,
    }),
    // Oeil (bien visible)
    React.createElement(Circle, { cx: 15, cy: 21, r: 4, fill: '#1A0A04' }),
    React.createElement(Circle, { cx: 16.5, cy: 19.5, r: 1.5, fill: '#FFFFFF', opacity: 0.9 }),
    // Bouche
    React.createElement(Path, {
      d: 'M 10 26 L 13 28',
      stroke: '#3A1004',
      strokeWidth: 2,
      strokeLinecap: 'round',
    }),
  );

// Reproduction vectorielle de fruits_marines.png — bol + fruits orangés + pique
const IcoFruitsMarines: React.FC<{ color: string }> = () =>
  React.createElement(
    Svg,
    { width: 36, height: 36, viewBox: '0 0 36 36' },
    // Pique (toothpick)
    React.createElement(Path, {
      d: 'M21 20 L29 4',
      stroke: '#D4C090',
      strokeWidth: 1.5,
      strokeLinecap: 'round',
    }),
    // Bol extérieur (coque marron foncé)
    React.createElement(Path, {
      d: 'M5 17 C4 27 9 33 18 33 C27 33 32 27 31 17 Q25 15 18 15 Q11 15 5 17 Z',
      fill: '#7A3812',
    }),
    // Bord du bol (rim orangé)
    React.createElement(Path, {
      d: 'M5 17 Q11 14 18 14 Q25 14 31 17',
      stroke: '#A04820',
      strokeWidth: 2.5,
      fill: 'none',
      strokeLinecap: 'round',
    }),
    // Sauce ambrée au fond
    React.createElement(Ellipse, { cx: 18, cy: 27, rx: 10, ry: 4.5, fill: '#C85010' }),
    // Fruit gauche
    React.createElement(Ellipse, { cx: 12, cy: 22, rx: 5, ry: 3.5, fill: '#F08830' }),
    // Fruit centre (devant)
    React.createElement(Ellipse, { cx: 19, cy: 20, rx: 5.5, ry: 3.5, fill: '#E87820' }),
    // Fruit droite
    React.createElement(Ellipse, { cx: 25, cy: 23, rx: 4, ry: 3, fill: '#F09038' }),
    // Reflets clairs sur les fruits
    React.createElement(Ellipse, { cx: 11, cy: 21, rx: 2, ry: 1, fill: '#FFB870', opacity: 0.6 }),
    React.createElement(Ellipse, { cx: 18, cy: 19, rx: 2.5, ry: 1, fill: '#FFB870', opacity: 0.5 }),
  );

export type CatId = 'stores' | 'tangana' | 'food' | 'hair' | 'sport' | 'bakery' | 'fruiterie';

export type ShopType = 'products' | 'services' | 'memberships' | 'terrains';

export interface SubcatOption {
  id: string;
  emoji: string;
  label: string;
  desc: string;
  imageUri?: number;
  SvgIcon?: React.FC<{ color: string }>;
  /** true → vitrine affiche la réservation de créneaux (TerrainCreneaux) */
  hasSlots?: boolean;
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
        SvgIcon: IcoTangana,
      },
      {
        id: 'ndeki',
        emoji: '🍲',
        label: 'Ndéki (Mama)',
        desc: 'Repas du midi, plats cuisinés',
        SvgIcon: IcoNdeki,
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
      {
        id: 'malibu',
        emoji: '🍹',
        label: 'Malibu',
        desc: 'Cocktails, boissons exotiques, ambiance',
        SvgIcon: IcoMalibu,
      },
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
        label: 'Snack & Gourmandise',
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
        SvgIcon: IcoFruitsMarines,
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
        SvgIcon: IcoCoiffeurHomme,
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
        React.createElement(Circle, { cx: 6, cy: 6, r: 2.5, stroke: color }),
        React.createElement(Circle, { cx: 6, cy: 18, r: 2.5, stroke: color }),
        React.createElement(Path, { d: 'M20 4L8.12 15.88', stroke: color }),
        React.createElement(Path, { d: 'M14.47 14.48L20 20', stroke: color }),
        React.createElement(Path, { d: 'M8.12 8.12L12 12', stroke: color }),
      ),
  },
  {
    id: 'sport',
    label: 'Sport',
    subLabel: 'Sport',
    emoji: '⚽',
    shopType: 'memberships',
    subcatMode: 'multiple',
    subcats: [
      {
        id: 'musculation',
        emoji: '🏋',
        label: 'Musculation / Fitness',
        desc: 'Salle de musculation, cardio',
      },
      {
        id: 'reservation_terrain_foot',
        emoji: '⚽',
        label: 'Réservation de terrain foot',
        desc: 'Terrain de football en salle ou en plein air',
        hasSlots: true,
      },
      {
        id: 'reservation_terrain_basket',
        emoji: '🏀',
        label: 'Réservation de terrain basket',
        desc: 'Terrain de basketball en salle ou en plein air',
        hasSlots: true,
      },
      { id: 'arts_martiaux', emoji: '🥊', label: 'Arts martiaux', desc: 'Boxe, judo, taekwondo…' },
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
        React.createElement(Rect, { x: 1, y: 8, width: 4, height: 8, rx: 1, stroke: color }),
        React.createElement(Rect, { x: 5, y: 10, width: 3, height: 4, rx: 0.5, stroke: color }),
        React.createElement(Path, { d: 'M8 12h8', stroke: color }),
        React.createElement(Rect, { x: 16, y: 10, width: 3, height: 4, rx: 0.5, stroke: color }),
        React.createElement(Rect, { x: 19, y: 8, width: 4, height: 8, rx: 1, stroke: color }),
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
