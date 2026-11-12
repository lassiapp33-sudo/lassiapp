// ⛔ FONCTION NEUTRALISÉE — NE SUPPRIME PLUS RIEN ⛔
//
// CAUSE RACINE DE L'INCIDENT (bucket "products", ~1876 images perdues) :
// l'ancien code faisait `admin.from('products').select('image_url')` alors que
// la colonne réelle est `photo_url`. Résultat : la liste des URLs "actives"
// était VIDE → deleteOrphans() considérait TOUS les fichiers comme orphelins →
// suppression de 100% du bucket products. Aucun backup storage → perte sèche.
//
// Aggravant : la fonction était déployée en verify_jwt=false (appelable sans
// authentification) → un simple appel HTTP pouvait re-déclencher la purge.
//
// Le corps destructif a été REMPLACÉ par ce stub qui refuse toute exécution.
// Plus aucune suppression de storage ne peut avoir lieu via cette route.
//
// Pour une purge légitime à l'avenir, créer une NOUVELLE fonction dédiée qui :
//   - exige verify_jwt=true + rôle admin,
//   - lit le BON nom de colonne (photo_url, avatar_url, logo_url, ...),
//   - impose un dry-run obligatoire renvoyant la liste avant toute suppression,
//   - ne supprime JAMAIS en masse par "tout sauf les actifs" sans garde-fou
//     (ex : refuser si > X% du bucket serait supprimé).

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve((req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  return new Response(
    JSON.stringify({
      disabled: true,
      error: 'cleanup-storage est définitivement désactivée (incident perte images bucket products). Aucune suppression effectuée.',
    }),
    { status: 410, headers: { ...CORS, 'Content-Type': 'application/json' } },
  );
});
