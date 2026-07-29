/**
 * config/categories.ts — Source unique de vérité pour toutes les catégories LASSI.
 * Utilisé par : inscription marchand, CatNavBar, CategoryGrid, CategoryScreen, filtres.
 */

import React from 'react';
import Svg, { Path, Circle, Rect, Ellipse } from 'react-native-svg';

const IMG_SOUPE      = require('../../assets/soupe_icon.webp');
const IMG_NEXX_SOW   = require('../../assets/nexx_sow.webp');
const IMG_JUS        = require('../../assets/jus_icon.webp');
const IMG_SNACK      = require('../../assets/snack_icon.png');
const IMG_BURGER     = require('../../assets/burger_icon.png');
const IMG_COIFFEUR_H = require('../../assets/coiffeur_h.webp');
const IMG_COIFFEUR_F = require('../../assets/coiffeur_f.webp');
const IMG_MALIBU     = require('../../assets/malibu_icon.webp');
const IMG_DIBITERI   = require('../../assets/dibiteri_icon.webp');
const IMG_SERAS_IMG  = require('../../assets/seras_icon.webp');
const IMG_NDEIKI     = require('../../assets/ndeiki_icon.webp');
const IMG_TANGANA    = require('../../assets/tangana_icon.webp');

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

// Femme avec longues tresses — sous-cat Femmes (coiffure)
const IcoCoiffeurFemme: React.FC<{ color: string }> = () =>
  React.createElement(
    Svg,
    { width: 36, height: 36, viewBox: '0 0 56 56' },
    // Corps / haut violet féminin
    React.createElement(Path, {
      d: 'M 8 56 L 8 43 C 8 39 15 37 28 37 C 41 37 48 39 48 43 L 48 56 Z',
      fill: '#9B59B6',
    }),
    // Cou
    React.createElement(Rect, { x: 22, y: 33, width: 12, height: 7, rx: 3, fill: '#F5C898' }),
    // Tête
    React.createElement(Circle, { cx: 28, cy: 21, r: 14, fill: '#F5C898' }),
    // Tresse gauche
    React.createElement(Path, {
      d: 'M 14 17 C 10 22 8 30 9 40 C 10 44 11 47 12 49',
      stroke: '#2D1A0A',
      strokeWidth: 7,
      fill: 'none',
      strokeLinecap: 'round',
    }),
    // Tresse droite
    React.createElement(Path, {
      d: 'M 42 17 C 46 22 48 30 47 40 C 46 44 45 47 44 49',
      stroke: '#2D1A0A',
      strokeWidth: 7,
      fill: 'none',
      strokeLinecap: 'round',
    }),
    // Calotte (haut de la tête)
    React.createElement(Path, {
      d: 'M 14 18 C 14 7 19 5 28 5 C 37 5 42 7 42 18 C 40 12 34 10 28 10 C 22 10 16 12 14 18 Z',
      fill: '#2D1A0A',
    }),
    // Motif tresse gauche
    React.createElement(Path, {
      d: 'M 9.5 23 L 12 26 M 9 31 L 11.5 34 M 9.5 39 L 12 42',
      stroke: '#F5C898',
      strokeWidth: 1.3,
      strokeLinecap: 'round',
    }),
    // Motif tresse droite
    React.createElement(Path, {
      d: 'M 46.5 23 L 44 26 M 47 31 L 44.5 34 M 46.5 39 L 44 42',
      stroke: '#F5C898',
      strokeWidth: 1.3,
      strokeLinecap: 'round',
    }),
    // Yeux
    React.createElement(Circle, { cx: 22, cy: 20, r: 2, fill: '#1A0A04' }),
    React.createElement(Circle, { cx: 22.8, cy: 19.2, r: 0.7, fill: '#FFF' }),
    React.createElement(Circle, { cx: 34, cy: 20, r: 2, fill: '#1A0A04' }),
    React.createElement(Circle, { cx: 34.8, cy: 19.2, r: 0.7, fill: '#FFF' }),
    // Nez
    React.createElement(Circle, { cx: 28, cy: 24, r: 1.5, fill: '#E0A070' }),
    // Sourire
    React.createElement(Path, {
      d: 'M 24 28 Q 28 33 32 28',
      stroke: '#C08050',
      strokeWidth: 1.8,
      fill: 'none',
      strokeLinecap: 'round',
    }),
    // Boucles d'oreilles dorées
    React.createElement(Circle, { cx: 14, cy: 23, r: 2.5, fill: '#FDCF34' }),
    React.createElement(Circle, { cx: 42, cy: 23, r: 2.5, fill: '#FDCF34' }),
    // Accessoire cheveux (arc rose au sommet)
    React.createElement(Path, {
      d: 'M 23 7 Q 28 3 33 7',
      stroke: '#FF69B4',
      strokeWidth: 3,
      fill: 'none',
      strokeLinecap: 'round',
    }),
  );

// Main avec ongles manucurés — sous-cat Esthétique & Ongles
const IcoEsthetique: React.FC<{ color: string }> = () =>
  React.createElement(
    Svg,
    { width: 36, height: 36, viewBox: '0 0 56 56' },
    // Flacon de vernis (côté gauche)
    React.createElement(Rect, { x: 3, y: 22, width: 10, height: 24, rx: 3.5, fill: '#E91E8C' }),
    React.createElement(Rect, { x: 4.5, y: 14, width: 7, height: 10, rx: 2, fill: '#BDBDBD' }),
    React.createElement(Rect, { x: 5.5, y: 11, width: 5, height: 5, rx: 1.5, fill: '#9E9E9E' }),
    // Reflet sur le flacon
    React.createElement(Path, {
      d: 'M 6 26 L 6 40',
      stroke: '#FFF',
      strokeWidth: 1.5,
      strokeLinecap: 'round',
      opacity: 0.45,
    }),
    // Pinceau sortant du bouchon
    React.createElement(Path, {
      d: 'M 13 16 L 21 24',
      stroke: '#7C4DFF',
      strokeWidth: 1.8,
      strokeLinecap: 'round',
    }),
    // === Doigt majeur (plus long, centre) ===
    React.createElement(Rect, { x: 28, y: 11, width: 9, height: 34, rx: 4.5, fill: '#F5C898' }),
    React.createElement(Ellipse, { cx: 32.5, cy: 15, rx: 4, ry: 5, fill: '#FF69B4' }),
    // === Doigt index (gauche du majeur) ===
    React.createElement(Rect, { x: 19, y: 17, width: 8, height: 28, rx: 4, fill: '#F5C898' }),
    React.createElement(Ellipse, { cx: 23, cy: 21, rx: 3.5, ry: 4.5, fill: '#FF69B4' }),
    // === Doigt annulaire (droite du majeur) ===
    React.createElement(Rect, { x: 38, y: 17, width: 8, height: 28, rx: 4, fill: '#F5C898' }),
    React.createElement(Ellipse, { cx: 42, cy: 21, rx: 3.5, ry: 4.5, fill: '#FF69B4' }),
    // === Auriculaire ===
    React.createElement(Rect, { x: 47, y: 22, width: 6, height: 23, rx: 3, fill: '#F5C898' }),
    React.createElement(Ellipse, { cx: 50, cy: 26, rx: 2.5, ry: 3.5, fill: '#FF69B4' }),
    // Paume
    React.createElement(Path, {
      d: 'M 17 46 C 17 51 20 54 26 54 L 50 54 C 54 54 56 51 56 47 L 56 43',
      stroke: '#F5C898',
      strokeWidth: 11,
      fill: 'none',
      strokeLinecap: 'round',
    }),
    // Séparations légères entre doigts
    React.createElement(Path, {
      d: 'M 27 45 L 27 17 M 37 45 L 37 17 M 46 45 L 46 22',
      stroke: '#E0A070',
      strokeWidth: 0.8,
      opacity: 0.5,
    }),
    // Sparkles
    React.createElement(Path, {
      d: 'M 50 8 L 50 4 M 48 6 L 52 6',
      stroke: '#FDCF34',
      strokeWidth: 1.5,
      strokeLinecap: 'round',
    }),
    React.createElement(Path, {
      d: 'M 16 7 L 16 4 M 14.5 5.5 L 17.5 5.5',
      stroke: '#FDCF34',
      strokeWidth: 1.2,
      strokeLinecap: 'round',
    }),
  );

// Bol de bouilli (sombi/thiéré) avec vapeur et cuillère en bois
const IcoSombiThiere: React.FC<{ color: string }> = () =>
  React.createElement(
    Svg,
    { width: 36, height: 36, viewBox: '0 0 56 56' },
    // Vapeur (3 volutes)
    React.createElement(Path, {
      d: 'M 18 14 C 18 10 22 10 22 6',
      stroke: '#B0BEC5', strokeWidth: 2, fill: 'none', strokeLinecap: 'round', opacity: 0.7,
    }),
    React.createElement(Path, {
      d: 'M 28 12 C 28 8 32 8 32 4',
      stroke: '#B0BEC5', strokeWidth: 2, fill: 'none', strokeLinecap: 'round', opacity: 0.7,
    }),
    React.createElement(Path, {
      d: 'M 38 14 C 38 10 42 10 42 6',
      stroke: '#B0BEC5', strokeWidth: 2, fill: 'none', strokeLinecap: 'round', opacity: 0.7,
    }),
    // Bol extérieur (argile brun-rouge)
    React.createElement(Path, {
      d: 'M 6 26 C 6 42 14 52 28 52 C 42 52 50 42 50 26 Z',
      fill: '#8D4E28',
    }),
    // Bouilli à l'intérieur (millet jaune crème)
    React.createElement(Ellipse, { cx: 28, cy: 26, rx: 22, ry: 7, fill: '#F0D080' }),
    // Texture du bouilli (grains)
    React.createElement(Ellipse, { cx: 20, cy: 25, rx: 2.5, ry: 1.5, fill: '#D4A830', opacity: 0.6 }),
    React.createElement(Ellipse, { cx: 28, cy: 24, rx: 2.5, ry: 1.5, fill: '#D4A830', opacity: 0.6 }),
    React.createElement(Ellipse, { cx: 36, cy: 25, rx: 2.5, ry: 1.5, fill: '#D4A830', opacity: 0.6 }),
    React.createElement(Ellipse, { cx: 24, cy: 28, rx: 2, ry: 1.2, fill: '#D4A830', opacity: 0.45 }),
    React.createElement(Ellipse, { cx: 32, cy: 28, rx: 2, ry: 1.2, fill: '#D4A830', opacity: 0.45 }),
    // Bord du bol (rebord épais)
    React.createElement(Ellipse, { cx: 28, cy: 26, rx: 22, ry: 7, fill: 'none', stroke: '#6D3318', strokeWidth: 2.5 }),
    // Cuillère en bois (posée sur le bol)
    React.createElement(Path, {
      d: 'M 42 18 L 52 8',
      stroke: '#A0631A', strokeWidth: 3.5, strokeLinecap: 'round',
    }),
    React.createElement(Ellipse, { cx: 40, cy: 21, rx: 4, ry: 3, fill: '#C07828' }),
  );

// ─── Stores ────────────────────────────────────────────────────────────────────

const IcoAlimentation: React.FC<{ color: string }> = () =>
  React.createElement(Svg, { width: 36, height: 36, viewBox: '0 0 56 56' },
    React.createElement(Path, { d: 'M 12 24 L 44 24 L 39 50 L 17 50 Z', fill: '#2196F3' }),
    React.createElement(Path, {
      d: 'M 20 24 C 20 14 23 9 28 9 C 33 9 36 14 36 24',
      stroke: '#1565C0', strokeWidth: 3.5, fill: 'none', strokeLinecap: 'round',
    }),
    React.createElement(Circle, { cx: 28, cy: 38, r: 9, fill: '#E53935' }),
    React.createElement(Path, {
      d: 'M 28 30 C 28 26 33 24 35 26 C 32 27 30 29 28 30 Z', fill: '#43A047',
    }),
    React.createElement(Path, {
      d: 'M 28 29 L 28 26', stroke: '#6D4C41', strokeWidth: 1.8, strokeLinecap: 'round',
    }),
    React.createElement(Ellipse, { cx: 24, cy: 34, rx: 2, ry: 3, fill: '#FFCDD2', opacity: 0.5 }),
  );

const IcoQuincaillerie: React.FC<{ color: string }> = () =>
  React.createElement(Svg, { width: 36, height: 36, viewBox: '0 0 56 56' },
    React.createElement(Path, {
      d: 'M 34 5 C 42 5 48 12 48 19 C 48 24 45 28 40 30 L 15 50 C 13 52 10 51 8 49 C 6 47 7 44 9 42 L 33 22 C 30 17 30 11 34 5 Z',
      fill: '#90A4AE',
    }),
    React.createElement(Rect, { x: 33, y: 5, width: 14, height: 7, rx: 3, fill: '#B0BEC5' }),
    React.createElement(Circle, { cx: 10, cy: 47, r: 5.5, fill: '#78909C' }),
    React.createElement(Path, {
      d: 'M 38 8 L 28 38', stroke: '#ECEFF1', strokeWidth: 1.5, opacity: 0.4, strokeLinecap: 'round',
    }),
    React.createElement(Path, {
      d: 'M 8 47 L 12 47 M 10 45 L 10 49',
      stroke: '#ECEFF1', strokeWidth: 1.2, strokeLinecap: 'round', opacity: 0.6,
    }),
  );

const IcoNexxSow: React.FC<{ color: string }> = () =>
  React.createElement(Svg, { width: 36, height: 36, viewBox: '0 0 56 56' },
    // Ombre portée au sol
    React.createElement(Ellipse, { cx: 28, cy: 54, rx: 15, ry: 2.5, fill: '#B0BEC5', opacity: 0.4 }),
    // Silhouette bouteille en verre (contour bleuté)
    React.createElement(Path, {
      d: 'M 28 52 C 14 52 10 46 10 38 C 10 28 14 20 18 16 L 18 10 L 38 10 L 38 16 C 42 20 46 28 46 38 C 46 46 42 52 28 52 Z',
      fill: '#E3F2FD',
    }),
    // Lait blanc à l'intérieur
    React.createElement(Path, {
      d: 'M 28 52 C 16 52 12 46 12 38 C 12 30 15 24 18 20 L 18 14 L 38 14 L 38 20 C 41 24 44 30 44 38 C 44 46 40 52 28 52 Z',
      fill: '#FFFFFF',
    }),
    // Verre bleuté au-dessus du niveau de lait
    React.createElement(Path, {
      d: 'M 14 34 C 17 32 20 34 23 32 C 26 30 30 32 33 31 C 36 30 40 32 42 34 C 44 32 44 28 42 22 L 38 16 L 38 14 L 18 14 L 18 16 L 14 22 C 12 28 12 32 14 34 Z',
      fill: '#BBDEFB', opacity: 0.35,
    }),
    // Vague surface du lait
    React.createElement(Path, {
      d: 'M 14 34 C 17 32 20 34 23 32 C 26 30 30 32 33 31 C 36 30 40 32 42 34',
      stroke: '#90CAF9', strokeWidth: 2, fill: 'none', strokeLinecap: 'round',
    }),
    // Étiquette centrale
    React.createElement(Rect, { x: 15, y: 37, width: 26, height: 12, rx: 4, fill: '#1565C0', opacity: 0.18 }),
    React.createElement(Path, {
      d: 'M 15 37 L 41 37 L 41 49 L 15 49 Z',
      fill: 'none', stroke: '#90CAF9', strokeWidth: 0.8,
    }),
    // Lignes de texte sur l'étiquette
    React.createElement(Rect, { x: 19, y: 40, width: 14, height: 2, rx: 1, fill: '#1565C0', opacity: 0.5 }),
    React.createElement(Rect, { x: 21, y: 44, width: 10, height: 1.5, rx: 0.75, fill: '#1565C0', opacity: 0.3 }),
    // Col de la bouteille
    React.createElement(Rect, { x: 20, y: 6, width: 16, height: 6, rx: 2.5, fill: '#ECEFF1', stroke: '#CFD8DC', strokeWidth: 1 }),
    // Capsule foil dorée
    React.createElement(Rect, { x: 19, y: 1, width: 18, height: 7, rx: 3.5, fill: '#FFC107' }),
    React.createElement(Rect, { x: 19, y: 6, width: 18, height: 2, rx: 0, fill: '#FF8F00' }),
    React.createElement(Path, {
      d: 'M 21 2 L 21 7', stroke: '#FFE082', strokeWidth: 1.5, strokeLinecap: 'round', opacity: 0.8,
    }),
    // Reflet verre principal (gauche)
    React.createElement(Path, {
      d: 'M 14 26 C 12 30 12 36 13 44',
      stroke: '#FFFFFF', strokeWidth: 4, strokeLinecap: 'round', opacity: 0.65,
    }),
    React.createElement(Path, {
      d: 'M 16 18 L 15 24',
      stroke: '#FFFFFF', strokeWidth: 2.5, strokeLinecap: 'round', opacity: 0.5,
    }),
    // Bulles de lait frais
    React.createElement(Circle, { cx: 23, cy: 27, r: 1.5, fill: '#E3F2FD', opacity: 0.9 }),
    React.createElement(Circle, { cx: 31, cy: 25, r: 1, fill: '#E3F2FD', opacity: 0.7 }),
    React.createElement(Circle, { cx: 36, cy: 28, r: 1.5, fill: '#E3F2FD', opacity: 0.8 }),
  );

// ─── Bakery ────────────────────────────────────────────────────────────────────

const IcoBoulangerie: React.FC<{ color: string }> = () =>
  React.createElement(Svg, { width: 36, height: 36, viewBox: '0 0 56 56' },
    React.createElement(Ellipse, { cx: 28, cy: 32, rx: 22, ry: 16, fill: '#C8860E' }),
    React.createElement(Ellipse, { cx: 28, cy: 27, rx: 18, ry: 11, fill: '#D4A030' }),
    React.createElement(Path, {
      d: 'M 28 18 L 28 36 M 20 27 L 36 27',
      stroke: '#9A5E08', strokeWidth: 2, strokeLinecap: 'round',
    }),
    React.createElement(Path, {
      d: 'M 16 22 C 20 18 28 17 36 20',
      stroke: '#F0D070', strokeWidth: 1.5, fill: 'none', opacity: 0.6, strokeLinecap: 'round',
    }),
    React.createElement(Ellipse, { cx: 28, cy: 47, rx: 22, ry: 4, fill: '#E8E0D0', opacity: 0.35 }),
  );

const IcoPatisserie: React.FC<{ color: string }> = () =>
  React.createElement(Svg, { width: 36, height: 36, viewBox: '0 0 56 56' },
    React.createElement(Path, { d: 'M 16 36 L 40 36 L 36 50 L 20 50 Z', fill: '#F5F5F5' }),
    React.createElement(Path, {
      d: 'M 19 36 L 18 50 M 26 36 L 25 50 M 32 36 L 31 50 M 38 36 L 37 50',
      stroke: '#BDBDBD', strokeWidth: 1.3, strokeLinecap: 'round',
    }),
    React.createElement(Ellipse, { cx: 28, cy: 35, rx: 16, ry: 7, fill: '#FFCC80' }),
    React.createElement(Path, {
      d: 'M 12 30 C 12 20 18 16 28 16 C 38 16 44 20 44 30 C 44 33 40 35 36 34 C 34 37 30 38 28 38 C 26 38 22 37 20 34 C 16 35 12 33 12 30 Z',
      fill: '#F06292',
    }),
    React.createElement(Circle, { cx: 28, cy: 12, r: 4, fill: '#D32F2F' }),
    React.createElement(Path, {
      d: 'M 28 12 C 30 8 34 7 36 9',
      stroke: '#388E3C', strokeWidth: 2, fill: 'none', strokeLinecap: 'round',
    }),
    React.createElement(Ellipse, { cx: 22, cy: 25, rx: 4, ry: 2.5, fill: '#FFF', opacity: 0.3 }),
    React.createElement(Circle, { cx: 24, cy: 33, r: 1.5, fill: '#FFF', opacity: 0.7 }),
    React.createElement(Circle, { cx: 33, cy: 31, r: 1.5, fill: '#FFF', opacity: 0.7 }),
  );

// ─── Food ──────────────────────────────────────────────────────────────────────

const IcoRestaurant: React.FC<{ color: string }> = () =>
  React.createElement(Svg, { width: 36, height: 36, viewBox: '0 0 56 56' },
    React.createElement(Circle, { cx: 28, cy: 30, r: 20, fill: '#FAFAFA', stroke: '#E0E0E0', strokeWidth: 1.5 }),
    React.createElement(Circle, { cx: 28, cy: 30, r: 14, fill: '#F5F5F5' }),
    React.createElement(Path, {
      d: 'M 7 10 L 7 20 M 10 10 L 10 20 M 13 10 L 13 20',
      stroke: '#9E9E9E', strokeWidth: 1.8, strokeLinecap: 'round',
    }),
    React.createElement(Path, {
      d: 'M 7 20 C 7 24 13 24 13 20', stroke: '#9E9E9E', strokeWidth: 1.8, fill: 'none',
    }),
    React.createElement(Path, {
      d: 'M 10 24 L 10 46', stroke: '#9E9E9E', strokeWidth: 2.5, strokeLinecap: 'round',
    }),
    React.createElement(Path, {
      d: 'M 46 10 L 46 46', stroke: '#9E9E9E', strokeWidth: 2.5, strokeLinecap: 'round',
    }),
    React.createElement(Path, {
      d: 'M 46 10 C 50 12 50 22 46 24', stroke: '#9E9E9E', strokeWidth: 1.8, fill: 'none',
    }),
  );

const IcoFastfood: React.FC<{ color: string }> = () =>
  React.createElement(Svg, { width: 36, height: 36, viewBox: '0 0 56 56' },
    React.createElement(Ellipse, { cx: 28, cy: 48, rx: 22, ry: 6, fill: '#D4922A' }),
    React.createElement(Ellipse, { cx: 28, cy: 40, rx: 20, ry: 5, fill: '#5D2E0C' }),
    React.createElement(Path, {
      d: 'M 8 36 C 10 32 14 31 18 33 C 20 30 24 30 26 32 C 28 29 32 29 34 32 C 36 30 40 31 44 34 C 46 35 48 37 48 38 L 8 38 Z',
      fill: '#43A047',
    }),
    React.createElement(Path, { d: 'M 10 30 L 46 30 L 50 34 L 8 34 Z', fill: '#FFC107' }),
    React.createElement(Ellipse, { cx: 28, cy: 28, rx: 18, ry: 3.5, fill: '#E53935' }),
    React.createElement(Ellipse, { cx: 28, cy: 15, rx: 22, ry: 13, fill: '#D4922A' }),
    React.createElement(Ellipse, { cx: 28, cy: 11, rx: 18, ry: 9, fill: '#E8B040' }),
    React.createElement(Ellipse, { cx: 22, cy: 10, rx: 2, ry: 1, fill: '#F5DEB3' }),
    React.createElement(Ellipse, { cx: 28, cy: 8, rx: 2, ry: 1, fill: '#F5DEB3' }),
    React.createElement(Ellipse, { cx: 34, cy: 10, rx: 2, ry: 1, fill: '#F5DEB3' }),
  );

// ─── Fruiterie ─────────────────────────────────────────────────────────────────

const IcoFruits: React.FC<{ color: string }> = () =>
  React.createElement(Svg, { width: 36, height: 36, viewBox: '0 0 56 56' },
    React.createElement(Path, {
      d: 'M 28 14 C 14 14 8 22 8 32 C 8 44 16 52 28 52 C 40 52 48 44 48 32 C 48 22 42 14 28 14 Z',
      fill: '#E53935',
    }),
    React.createElement(Path, {
      d: 'M 24 52 C 26 54 30 54 32 52', stroke: '#B71C1C', strokeWidth: 1.5, fill: 'none', strokeLinecap: 'round',
    }),
    React.createElement(Path, {
      d: 'M 28 8 C 28 4 36 2 38 6 C 34 6 30 8 28 14 C 28 12 28 10 28 8 Z', fill: '#43A047',
    }),
    React.createElement(Path, {
      d: 'M 28 14 L 28 8', stroke: '#5D4037', strokeWidth: 2, strokeLinecap: 'round',
    }),
    React.createElement(Path, {
      d: 'M 16 22 C 18 18 24 17 28 19',
      stroke: '#FFCDD2', strokeWidth: 3.5, fill: 'none', strokeLinecap: 'round', opacity: 0.55,
    }),
  );

// ─── Sport ─────────────────────────────────────────────────────────────────────

const IcoMusculation: React.FC<{ color: string }> = () =>
  React.createElement(Svg, { width: 36, height: 36, viewBox: '0 0 56 56' },
    React.createElement(Rect, { x: 2, y: 20, width: 12, height: 16, rx: 4, fill: '#455A64' }),
    React.createElement(Rect, { x: 14, y: 24, width: 8, height: 8, rx: 3, fill: '#546E7A' }),
    React.createElement(Rect, { x: 42, y: 20, width: 12, height: 16, rx: 4, fill: '#455A64' }),
    React.createElement(Rect, { x: 34, y: 24, width: 8, height: 8, rx: 3, fill: '#546E7A' }),
    React.createElement(Rect, { x: 22, y: 26, width: 12, height: 4, rx: 2, fill: '#78909C' }),
    React.createElement(Path, {
      d: 'M 24 27 L 32 27', stroke: '#ECEFF1', strokeWidth: 1, opacity: 0.4, strokeLinecap: 'round',
    }),
  );

const IcoTerrainFoot: React.FC<{ color: string }> = () =>
  React.createElement(Svg, { width: 36, height: 36, viewBox: '0 0 56 56' },
    React.createElement(Circle, { cx: 28, cy: 28, r: 24, fill: '#F5F5F5', stroke: '#424242', strokeWidth: 2 }),
    React.createElement(Path, { d: 'M 28 20 L 35 25 L 33 33 L 23 33 L 21 25 Z', fill: '#424242' }),
    React.createElement(Path, { d: 'M 20 7 L 28 4 L 36 7 L 36 17 L 28 20 L 20 17 Z', fill: '#424242' }),
    React.createElement(Path, { d: 'M 35 25 L 46 21 L 51 30 L 46 40 L 36 40 L 33 33 Z', fill: '#424242' }),
    React.createElement(Path, { d: 'M 23 33 L 20 40 L 10 40 L 5 30 L 10 21 L 21 25 Z', fill: '#424242' }),
    React.createElement(Path, { d: 'M 33 33 L 36 42 L 28 50 L 20 42 L 23 33 L 28 36 Z', fill: '#424242' }),
  );

const IcoTerrainBasket: React.FC<{ color: string }> = () =>
  React.createElement(Svg, { width: 36, height: 36, viewBox: '0 0 56 56' },
    React.createElement(Circle, { cx: 28, cy: 28, r: 24, fill: '#E65100' }),
    React.createElement(Path, { d: 'M 28 4 C 34 10 34 46 28 52', stroke: '#1A1A1A', strokeWidth: 2, fill: 'none' }),
    React.createElement(Path, { d: 'M 4 28 L 52 28', stroke: '#1A1A1A', strokeWidth: 2 }),
    React.createElement(Path, { d: 'M 4 28 C 8 16 16 10 28 4', stroke: '#1A1A1A', strokeWidth: 2, fill: 'none' }),
    React.createElement(Path, { d: 'M 52 28 C 48 16 40 10 28 4', stroke: '#1A1A1A', strokeWidth: 2, fill: 'none' }),
    React.createElement(Path, { d: 'M 4 28 C 8 40 16 46 28 52', stroke: '#1A1A1A', strokeWidth: 2, fill: 'none' }),
    React.createElement(Path, { d: 'M 52 28 C 48 40 40 46 28 52', stroke: '#1A1A1A', strokeWidth: 2, fill: 'none' }),
    React.createElement(Circle, { cx: 28, cy: 28, r: 24, fill: 'none', stroke: '#1A1A1A', strokeWidth: 2 }),
    React.createElement(Ellipse, { cx: 20, cy: 18, rx: 5, ry: 4, fill: '#FF6D00', opacity: 0.45 }),
  );

const IcoArtsMartaux: React.FC<{ color: string }> = () =>
  React.createElement(Svg, { width: 36, height: 36, viewBox: '0 0 56 56' },
    React.createElement(Path, {
      d: 'M 6 30 C 6 22 8 15 13 11 C 13 15 12 22 13 28 C 11 30 9 32 9 36 C 9 40 11 44 13 46 C 9 44 6 40 6 30 Z',
      fill: '#B71C1C', opacity: 0.75,
    }),
    React.createElement(Path, {
      d: 'M 12 36 C 12 28 14 20 20 16 C 26 12 36 14 40 20 C 44 26 44 36 40 42 C 36 48 28 50 22 48 C 16 46 12 44 12 36 Z',
      fill: '#C62828',
    }),
    React.createElement(Rect, { x: 16, y: 43, width: 22, height: 12, rx: 4, fill: '#E8E8E8' }),
    React.createElement(Path, { d: 'M 16 46 L 38 46 M 16 50 L 38 50', stroke: '#BDBDBD', strokeWidth: 1.5 }),
    React.createElement(Path, {
      d: 'M 28 14 C 32 18 34 28 32 36',
      stroke: '#B71C1C', strokeWidth: 2, fill: 'none', strokeLinecap: 'round',
    }),
    React.createElement(Ellipse, { cx: 22, cy: 24, rx: 5, ry: 7, fill: '#EF5350', opacity: 0.5 }),
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
  imageSize?: number;
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
        id: 'nexx_sow',
        emoji: '🥛',
        label: 'Nexx sow',
        desc: 'Lait frais, produits laitiers',
        imageUri: IMG_NEXX_SOW,
        imageSize: 60,
      },
      {
        id: 'sombi_ak_thiere',
        emoji: '🥣',
        label: 'Sombi ak Thiéré',
        desc: 'Sombi, thiéré, céréales traditionnelles',
        SvgIcon: IcoSombiThiere,
      },
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
        imageSize: 50,
      },
      {
        id: 'ndeki',
        emoji: '🍲',
        label: 'Ndéki (Mama)',
        desc: 'Repas du midi, plats cuisinés',
        imageUri: IMG_NDEIKI,
        imageSize: 68,
      },
      {
        id: 'soupe',
        emoji: '🥣',
        label: 'Soupe',
        desc: 'Soupes, potages, bouillons maison',
        imageUri: IMG_SOUPE,
        imageSize: 44,
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
        SvgIcon: IcoRestaurant,
      },
      { id: 'fastfood', emoji: '🍔', label: 'Fast-food', desc: 'Burgers, shawarma, sandwichs', imageUri: IMG_BURGER, imageSize: 52 },
      {
        id: 'malibu',
        emoji: '🍹',
        label: 'Malibu',
        desc: 'Cocktails, boissons exotiques, ambiance',
        imageUri: IMG_MALIBU,
        imageSize: 52,
      },
      { id: 'dibiterie', emoji: '🥩', label: 'Dibiterie', desc: 'Viande grillée, thiébou guinar', imageUri: IMG_DIBITERI, imageSize: 56 },
      { id: 'seras', emoji: '🔥', label: 'Séraas', desc: 'Poisson braisé, fruits de mer', imageUri: IMG_SERAS_IMG, imageSize: 56 },
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
        imageSize: 50,
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
      { id: 'fruits', emoji: '🍎', label: 'Fruits frais', desc: 'Fruits frais de saison', SvgIcon: IcoFruits },
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
        imageUri: IMG_COIFFEUR_H,
        imageSize: 56,
      },
      {
        id: 'femmes',
        emoji: '💇‍♀️',
        label: 'Femmes',
        desc: 'Tresses, tissage, soins, brushing',
        imageUri: IMG_COIFFEUR_F,
        imageSize: 44,
      },
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
        SvgIcon: IcoMusculation,
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
