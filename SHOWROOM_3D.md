# SHOWROOM 3D LASSI — Spec complète (base de reprise)

> Fonctionnalité payante : vitrine 3D interactive navigable pour prestataires LASSI.
> Inspiration : Mushei (`3d.mushei.store`) — boutique 3D navigable intégrée au site web.
> **Dernière MAJ : 2026-11-22**

---

## 1. CONCEPT

Boutique 3D navigable (type Mushei) où le client explore la vitrine d'un prestataire,
voit les produits sur des socles/présentoirs (hotspots cliquables → fiche produit →
Commander / Chat in-app), avec des personnages animés pour donner vie au lieu.

- **Hébergement** : Web + WebView dans l'app (Three.js sur `s.lassi.tech`, PAS natif RN). Zéro rebuild, OTA possible.
- **Intégration** : après achat, la visite 3D s'intègre au site web du prestataire (section "Visite 3D" comme Mushei).
- **Moteur** : Three.js + React Three Fiber. Assets **GLB/GLTF Draco+Meshopt**, textures KTX2/WebP.

---

## 2. OFFRE & PRIX (décidé)

| | **Showroom (25k)** | **Boutique Vivante (50k)** |
|---|---|---|
| Environnement 3D navigable | ✅ | ✅ |
| Vue | 1ère personne | **3e personne, avatar choisi + nom** |
| Hotspots produits | ✅ | ✅ |
| Vendeur PNJ Q&R | — | ✅ |
| Acheteurs PNJ (ambiance, dialogues scriptés) | — | ✅ |

**Formules de prix (décidé : mensuel + annuel)**
- Showroom : **2 500 F/mois** ou **25 000 F/an** (2 mois offerts)
- Vivante : **5 000 F/mois** ou **50 000 F/an** (2 mois offerts)
- Annuel = 10 mois payés pour 12 → incite au paiement d'avance.
- **Prix de test actuel : 10 F** (paiement réel) tant que validation en cours.
- Infra paiement : réutiliser le système d'abonnement visibilité existant (Wave/OM, `reconcile-visibility-subs`, `notified_at`). Annuel = 1 paiement + expiry +365j.

---

## 3. MULTIJOUEUR — ANNULÉ

Décidé : **pas de multijoueur**. Tout scripté/déterministe → zéro serveur temps réel,
zéro coût variable, zéro modération. L'effet "boutique vivante" vient des PNJ scriptés.
(Analyse conservée : niveaux 1-3 via Supabase Realtime faisables mais coût message non nul
à grande échelle ; vocal = WebRTC+TURN payant. Écarté.)

---

## 4. EXPÉRIENCE 3e PERSONNE + PNJ (MVP en cours)

- Le client **choisit un avatar + saisit son nom** → entre dans la boutique en 3e personne.
- Caméra suit le perso, joystick = déplacement, drag écran = tourner.
- **Vendeur PNJ** : menu Q→R. Banque **LASSI prédéfinie** (certaines réponses auto depuis
  vraies données : `__auto_hours__` = `opening_hours`, `__auto_bestseller__` = ventes/notes)
  + **questions custom prestataire** (éditables depuis l'app). Le PNJ pioche dans la liste →
  **aucune IA qui hallucine**, réponses 100% contrôlées.
- **Acheteurs PNJ** : marchent (patrouille) et **discutent entre eux** (bulles + emotes scriptées).
- **Emotes** déclenchées par nom (`dance`, `laugh`, `wave`…) → tape le nom, le perso joue le clip.

---

## 5. INTÉGRATION APP (où ça vit)

Écran **"Mon site web"** (existant, voir [[project_site_builder]]) a 2 cartes
("Configurer mon site actuel", "Choisir un template"). → **Ajouter 3e carte "Visite 3D"**.

Flux : carte "Visite 3D" → galerie des templates 3D (≥10 environnements) → chaque template
a un bouton **"Explorer"** (= sa vraie vitrine 3D, rendu réel) + achat 25k/50k.
Après achat → intégré au site `s.lassi.tech/3d/{slug}`.

- Stockage config : table `site_config` JSONB existante → clé `showroom_3d`
  `{env_id, tier, hotspots:[{x,y,z,product_id}], branding, avatar_npcs, qa:{...}}`
- Scènes GLB : bucket Supabase `showrooms/`.
- Hotspots → `product_id` → fiche produit prix client +1% (comme vitrine web actuelle).

---

## 6. ROADMAP PHASES

| Phase | Contenu | Statut |
|---|---|---|
| **MVP** | Showroom 3e personne solo + vendeur Q&R + PNJ ambiance, env #1 Black N Gold | 🛠️ en cours |
| **B** | Avatar à l'inscription (`profiles.avatar_id` + nom) → **sprite 2D animé** sur la carte LASSI (remplace le point guide bleu) | 📋 planifié |
| **C** | **Catégorie "3D" sur la carte** = quartier/rue 3D stylisé (décidé) où apparaissent **uniquement les shops abonnés 3D** = devantures ; le perso marche dans la rue → entre direct dans le showroom | 📋 planifié |

**Principe directeur** : le 3D lourd ne touche JAMAIS la carte Google réelle (sprite 2D léger là-bas).
Le full 3D vit dans son hub dédié (la rue) où il brille et **incite à l'abo** (seuls les payants y apparaissent).
Le showroom MVP = **brique réutilisée** partout → rien n'est perdu.

---

## 7. PIPELINE ENVIRONNEMENTS 3D (Blender → Web)

Source : `D:\BLENDER\blend\envi\BlenderKit Scenes Pack #1\` (plusieurs scènes).
Objectif : **≥10 environnements** variés (éviter la ressemblance), mutualisés.
25k = choix dans la lib mutualisée. 50k = env dédié/custom possible.

**Pipeline par env :**
1. Decimate léger (cible ~50k tris, budget < 150k)
2. **Baker les matériaux procéduraux** en textures PBR (le web glTF ne lit pas les shaders procéduraux Blender → sinon rendu gris/noir)
3. Nettoyer caméras/lights inutiles, appliquer transforms
4. Export **GLB Draco + Meshopt**, textures KTX2/WebP, cible **3-6 Mo**
5. Noter coords 3D des socles → ancrages hotspots

### Env #1 : "Black N Gold" ✅ FAIT
- Fichier : `D:\BLENDER\blend\envi\BlenderKit Scenes Pack #1\14 - Black N Gold\black-n-gold_*.blend`
- Showroom luxe noir & or, podiums/socles = emplacements produits. Idéal bijoux/montres/parfums/mode.
- Stats : 94 448 tris, 49 886 verts, 41 meshes, 3 matériaux.
- Matériaux : "Black leather" + "Brass tiles" = textures image PBR ; **"Gold" = procédural** → remplacé par PBR gold propre (baseColor (1,0.72,0.30), metallic 1, rough 0.18).
- **GLB exporté : 3.8 Mo** → `C:\Users\USER\Downloads\showroom_out\black-n-gold.glb`
- ⚠️ Mur de fond gris sans HDRI en render Blender ; OK dans le viewer web (RoomEnvironment). À texturer pour finition.

---

## 8. POC WEB (déjà construit)

Dossier : `C:\Users\USER\Downloads\showroom_out\`
- `index.html` — viewer **1ère personne** (joystick + hotspots + look)
- `boutique3d.html` — viewer **3e personne complet** (sélection avatar + nom, PNJ, vendeur Q&R, emotes, dialogues ambiance)
- `character.js` — classe `Character` **placeholder** (primitifs animés par code) → **à remplacer par GLTFLoader+AnimationMixer** quand vrais GLB arrivent
- `data/interactions.json` — **data-driven** : avatars, npcs, vendor_qa (lassi_predefined + merchant_custom), ambient_dialogues, emotes
- Test local : `cd showroom_out && python -m http.server 8777` → `http://localhost:8777/boutique3d.html`

**3 points de branchement pour vrais assets** :
1. `Character` (primitifs) → GLB animé (GLTFLoader + AnimationMixer)
2. `setEmote()` procédural → clips d'anim réels mappés par nom
3. couleurs avatars → modèles GLB (champ `model` déjà prévu dans le JSON)

---

## 9. PERSONNAGES (pipeline & convention)

### Principaux (avatars jouables)
- 1 dossier par perso, **anims propres** = `walk` + `talk` + **5 anims custom titrées**
- Mon système génère **1 bouton emote par anim** (lit la liste dans le JSON)

### Secondaires (PNJ ambiance + vendeurs) — système "groupes par rig"
```
Groupe A (même rig) : 1 CHEF animé → ses clips distribués à tous les membres du groupe
Groupe B (autre rig) : 1 CHEF animé → distribués à ses membres
```
- L'utilisateur fait la séparation en groupes + 1 chef animé/groupe.
- Claude distribue les clips du chef aux membres (retarget) **si même rig**.
- Détection compat : **signature rig** (nb d'os + noms d'os) chef vs membre. Si incompatible → Claude donne le nom → l'utilisateur le déplace dans un autre groupe.

### Convention noms de clips (minuscules exactes, OBLIGATOIRE)
```
idle   (obligatoire)   walk (obligatoire)   talk (discuter)
run    wave    dance    laugh    nod    + customs simples sans espace
```

### Budget perf perso
- **< 15 000 tris / perso**, textures ≤ 1024px (JPG/PNG)
- Pour le web : **baker Auto-Rig Pro → squelette deform simple** (exporteur ARP GLTF), **retirer Faceit** (anim faciale inutile), garder anims corps.

### Perso #1 test : "Little Kid" (petite fille) — EN COURS
- Fichier Blender ouvert : `...\BlenderKit Scenes Pack #1\...\Little Kid` (?)
- Rig : **Auto-Rig Pro** (`rig`, 554 os) + **Faceit** facial (`FaceitControlRig`, 78 os) + armature `Little Kid` (110 os)
- Propre & bien riggée. ✅ idéale comme source (optim web à faire par Claude).
- ⚠️ Polycount à confirmer (< 15k).

### ✅ Perso #1 EXPORTÉ & VALIDÉ EN LIVE (2026-11-22)
- `showroom_out/chars/petite_fille.glb` — **5,4 Mo**, texturée, marche au joystick, idle au repos, dans Black N Gold. Testé live via Chrome MCP.
- Branché dans `boutique3d.html` via `glbCharacter.js` (GLTFLoader + AnimationMixer). Avatar "Awa" (av1) a `model` défini.

### PIPELINE CC (Character Creator) → WEB — le moule validé
Perso CC = base_body 26k tris + Subsurf + rig ARP 554 os + Faceit + ~90 textures 2048. Étapes :
1. **Textures** : brancher les images `*_Diffuse` DIRECT sur Principled Base Color (les node groups CC `rl_*_shader` ne s'exportent PAS → sinon blanc). Downscale images à 1024.
2. **metallicFactor** : mettre Metallic=0 + Roughness~0.75 sur tous les Principled (délier du group). SINON glTF exporte metallicFactor=1 → chrome blanc.
3. **Root motion** : mute les fcurves `c_root_master.*.location` → walk sur-place (avatar contrôlable). Version "avance" = ne pas muter (pour la carte).
4. **Export** : `export_def_bones=True` (161 os vs 554), `export_optimize_animation_size`, textures JPEG q85, Draco, PAS de morph, PAS Faceit (désélectionner). export_apply=False (garde subsurf non appliqué).
5. Meshes gardés : CC_Base_Body/Eye/Teeth/Tongue/Eyelash, Hair, Toon_Sneakers_B, Cube_002, _0. Drop TearLine/EyeOcclusion (displaces lourds).

### ⚠️ FIX WASHOUT (blanc) côté viewer — OBLIGATOIRE pour persos CC
Même metallic=0, l'environnement HDRI (RoomEnvironment) délave les couleurs claires vers le blanc. Dans `glbCharacter.js` sur chaque matériau :
```
mat.metalness=0; mat.roughness=1; mat.envMapIntensity=0.15;
mat.map.colorSpace=SRGBColorSpace;
mat.emissive=0xffffff; mat.emissiveMap=mat.map; mat.emissiveIntensity=0.55; // couleur auto-affichée
```
Diagnostic clé : si blanc, tester en MeshBasicMaterial (unlit) → si couleurs OK = problème lighting/env, pas texture. (three r160 : `scene.environmentIntensity` ignoré, utiliser `material.envMapIntensity`.)

### Astuce walk cyclique (résolu, à refaire par l'utilisateur seul)
Marche qui s'arrêtait à frame 83 → **modificateur F-Curve "Cycles"** :
- Graph Editor → `A` (tout sélect) → Channel › Extrapolation Mode › **Make Cyclic (F-Modifier)** (boucle sur place)
- Puis `N` → onglet Modifiers → passer en **"Repeat with Offset"** (avance au lieu de rebouclersur place)
- Appliquer à toutes : clic droit sur le champ → **Copy to Selected**
- Root motion = os `c_root_master.x` (ARP), avance vers l'avant (translation Z). Walk = forward motion, pas sur place (cf [[feedback_blender_walk_forward]]).
- Timeline End = 150.

---

## 10. BLENDER MCP — accès

- Port socket **9876** ouvert quand Blender ouvert + addon MCP actif.
- Pas de tool natif `mcp__blender__` → parler au serveur via **socket Python** :
  `{"type":"execute_code","params":{"code":"..."}}` ou `{"type":"get_scene_info"}`.
- **Blender 5.0** : nouveau système d'actions à slots. Les fcurves sont dans
  `action.layers[].strips[].channelbags[].fcurves` (PAS `action.fcurves` directement).
- Carte blanche PC autorisée pour Blender (cf [[feedback_blender_dual_method]], [[feedback_blender_autoconnect]]).

---

## 11. PROCHAINES ÉTAPES

1. ⏳ Utilisateur finit **1 perso principal complet** (idle+walk+talk+5) OU **1 groupe secondaire test** (chef + 2-3 membres)
2. Claude : remplace placeholder par vrai pipeline GLB animé dans `character.js`, teste poids/fps, montre rendu dans Black N Gold
3. Si OK → utilisateur lance toute la lib sur le même moule
4. Puis : finition env #1 (texturer mur fond, poser produits réels), scan dossier `D:\BLENDER\blend\envi\` pour sélectionner les 10 environnements
5. Intégration app : 3e carte "Visite 3D" + flux achat 10F→25k/50k
