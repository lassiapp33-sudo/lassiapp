---
name: terrain-booking-system
description: Système de réservation de terrains de sport — architecture complète implémentée
metadata:
  type: project
---

Système de réservation terrain complet (football, basket, tennis…) intégré dans LASSI.

**Why:** Feature demandée pour permettre aux clients de réserver des créneaux de terrain chez un prestataire LASSI, avec paiement intégral et QR code de validation.

**How to apply:** Le shopType 'terrains' est désormais reconnu dans toute l'app.

## Architecture

### Nouvelles tables SQL
Migration: `supabase/migrations/terrains.sql`
- `terrains` — catalogue des terrains (lié à `profiles.id` via `prestataire_id`)
- `terrain_horaires` — horaires par jour de semaine
- `reservations_terrain` — réservations avec contrainte GIST anti-doublon

### Nouveaux fichiers frontend
- `src/types/terrain.ts` — types Terrain, TerrainHoraire, CreneauPris, ReservationTerrain
- `src/services/terrains.ts` — service CRUD + RPC get_crenaux_pris + verifyTerrainPayment
- `src/screens/terrain/TerrainBookingScreen.tsx` — sélection date/durée/créneau (vert/rouge)
- `src/screens/terrain/TerrainPaymentScreen.tsx` — paiement Wave/OM + création réservation atomique
- `src/screens/terrain/TerrainQRScreen.tsx` — QR code react-native-qrcode-svg après paiement
- `src/screens/merchant/TerrainScreen.tsx` — gestion terrains + liste réservations
- `src/screens/merchant/TerrainScanScreen.tsx` — validation QR par saisie code 8 chars
- `supabase/functions/verify-terrain-payment/index.ts` — Edge Function paiement terrain

### Fichiers modifiés
- `src/config/categories.ts` — 'terrains' ajouté à ShopType
- `src/services/shops.ts` + `auth.ts` — shopType élargi
- `src/store/shopStore.ts` — getDefaultCats gère 'terrains'
- `src/screens/shop/ShopScreen.tsx` — mode terrain (terrain cards + onBookTerrain prop)
- `src/screens/home/HomeNavigator.tsx` — terrain_booking / terrain_payment / terrain_qr
- `src/screens/merchant/MerchantNavigator.tsx` — terrains + terrain_scan
- `src/components/merchant/QuickActions.tsx` — carte Terrains (showTerrains prop)
- `src/screens/merchant/MerchantDashboard.tsx` — NavDest + showTerrains conditionnel

## Flux client
ShopScreen (shopType='terrains') → TerrainBookingScreen → TerrainPaymentScreen → TerrainQRScreen

## Flux prestataire
MerchantDashboard → TerrainScreen → TerrainScanScreen (scan QR = verify_terrain_receipt RPC)

## Edge Function requise
`verify-terrain-payment` — doit être déployée avec WAVE_SECRET_KEY + OM_API_KEY dans .env Supabase
