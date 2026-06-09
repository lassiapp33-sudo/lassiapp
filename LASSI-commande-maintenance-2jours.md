# 🩺👑 COMMANDE DE MAINTENANCE LASSİ — À LANCER TOUS LES 2 JOURS

> Pour : Seculiv, responsable unique de l'app au lancement. Cette commande fait un **diagnostic ultra-détaillé coin par coin** de toute l'app, anticipe les bugs futurs, **localise et renforce les failles de sécurité** (y compris piraterie/abus, en défensif), et **corrige** — avec un protocole git qui rend **tout réversible** (rien n'est perdu, rien ne casse durablement).
>
> COMMENT FAIRE : ouvre Claude Code dans le dossier du projet (session fraîche), puis **copie-colle tout le bloc “PROMPT” ci-dessous**.
> ⚠️ Avant de lancer : assure-toi d'avoir commité ton travail en cours (`git add . && git commit -m "wip"`), pour partir propre.

---

## 📋 PROMPT À COPIER-COLLER (intégralement)

> Tu es l'ingénieur de maintenance de l'app LASSİ (Expo + expo-router + Supabase, paiements Wave/OM). Effectue une **passe de maintenance complète** en suivant STRICTEMENT le protocole ci-dessous. Tu travailles avec prudence : **le diagnostic ne casse rien ; les corrections sont sûres, vérifiées et réversibles.**
>
> ### PHASE 0 — SÉCURITÉ GIT (obligatoire AVANT toute modification)
> 1. Vérifie que l'arbre git est propre (`git status`). S'il y a des changements non commités, **arrête-toi** et demande-moi de commiter d'abord.
> 2. Crée un **commit checkpoint** : `git add . && git commit -m "checkpoint avant maintenance" --allow-empty`.
> 3. Crée et bascule sur une **branche de maintenance** datée : `git checkout -b maintenance/AAAA-MM-JJ`.
> 4. Confirme-moi que le checkpoint et la branche sont créés avant de continuer.
>
> ### PHASE 1 — DIAGNOSTIC ULTRA-DÉTAILLÉ (lecture seule, NE MODIFIE RIEN)
> Inspecte l'app **coin par coin** et produis un rapport `DIAGNOSTIC-AAAA-MM-JJ.md`. Couvre AU MINIMUM :
> **A. Sécurité & accès**
> - RLS Supabase : chaque table a-t-elle des policies correctes ? Cherche les **IDOR** (un user peut-il lire/modifier les données d'un autre ?). Vérifie client vs prestataire vs admin.
> - Auth : sessions, expiration, routes protégées, fuite de token, stockage non sécurisé de secrets côté client.
> - Secrets : aucun secret/clé en dur ; `.env` bien ignoré ; clés `service_role` jamais côté client.
> - Paiement : montants **recalculés serveur** (jamais le prix client), idempotence (anti double-paiement), anti-rejeu, statut payé vérifié serveur, pas de chemin “gratuit”.
> - Reçu 40 min, VIP, avis : validité/contrôles **côté serveur**, usage unique, anti-fraude (seul un client ayant commandé peut noter), pas d'édition par le marchand.
> **B. Injections & entrées**
> - Injection SQL, **XSS / injection JS** (WebView carte, contenus utilisateur), validation/whitelist des entrées, échappement, params de navigation non typés.
> **C. Robustesse / bugs**
> - Promesses non gérées, try/catch manquants, `undefined`/null non gérés, `setState` après unmount, race conditions, double-soumission, transactions non atomiques (commandes orphelines), updates optimistes sans rollback.
> **D. Anticipation (bugs futurs / montée en charge)**
> - Requêtes sans pagination/index (lenteur quand la base grandit), listes non virtualisées, fuites mémoire, abonnements Realtime non nettoyés, limites de quota Supabase/Storage, dépendances obsolètes ou vulnérables.
> - Cas limites : hors-ligne, connexion lente, données partielles, valeurs extrêmes.
> **E. Abus / piraterie (défensif)**
> - Manipulation de prix/quantité/commission côté client, rejeu de requêtes, spam (avis, commandes, signalements), absence de rate-limiting, accès à des objets non autorisés, deep links non sécurisés. Localise les points faibles et propose le **renforcement** (défensif uniquement).
> **F. Qualité**
> - Code mort, console.log en prod, `any`, deps useEffect, incohérences.
>
> Pour chaque problème : **tableau** Sévérité (🔴 Critique / 🟠 Haute / 🟡 Moyenne / ⚪ Basse) | Emplacement (fichier:ligne) | Type | Présent ou Anticipé | Correctif proposé | **Risque du correctif** (Sûr / Sensible).
>
> ### PHASE 2 — CLASSER LES CORRECTIFS
> - **SÛRS** (à appliquer automatiquement) : correctifs qui **ne changent pas le comportement métier** — ajout de validation/échappement, ajout de RLS manquante évidente, null-checks, try/catch, nettoyage d'abonnements, retrait de secret/log sensible, fix de deps useEffect sans boucle, renforcement défensif sans effet de bord visible.
> - **SENSIBLES** (NE PAS appliquer seul — me les présenter pour décision) : tout ce qui touche la logique métier, les montants, les migrations de données, la suppression de fichiers/données, un changement d'UX, ou tout correctif au comportement incertain.
>
> ### PHASE 3 — APPLIQUER LES CORRECTIFS SÛRS (un par un)
> Pour CHAQUE correctif sûr :
> 1. Applique la modification minimale.
> 2. Vérifie que ça **build** (Expo) et que `npx tsc --noEmit` passe ; lance le lint si dispo.
> 3. Si le build/types cassent → **annule ce correctif** (`git checkout -- <fichier>`) et note-le comme “à revoir”.
> 4. Si OK → **commit dédié** : `git add . && git commit -m "maint: <description courte>"`.
> ⚠️ Ne jamais empiler plusieurs correctifs dans un seul commit. Ne jamais laisser le build cassé.
>
> ### PHASE 4 — INTERDITS ABSOLUS
> - Ne modifie JAMAIS les **valeurs** dans `.env` ni aucun secret.
> - N'exécute AUCUNE migration destructive ni suppression de données/fichiers utilisateurs.
> - Ne pousse RIEN si le build est cassé.
> - N'applique AUCUN correctif “Sensible” sans mon accord.
> - Reste **défensif** sur la sécurité (renforcer/protéger), jamais d'outil offensif.
>
> ### PHASE 5 — RAPPORT FINAL
> Produis `MAINTENANCE-AAAA-MM-JJ.md` :
> - ✅ Correctifs sûrs appliqués (liste + commits).
> - ⚠️ Correctifs **sensibles** en attente de ma décision (avec recommandation claire et impact).
> - 🔮 Risques anticipés (futurs) à surveiller.
> - 🧪 Résultat build / tsc / lint.
> - 📌 Points bloqués (ex : clés API à brancher).
> Termine en me disant : « Maintenance terminée sur la branche maintenance/AAAA-MM-JJ. Rien n'est sur main. Teste l'app, puis dis-moi si je fusionne (merge) ou si j'annule. »

---

## ✅ APRÈS LA COMMANDE (ce que TOI tu fais)
1. **Teste l'app** (les flux clés : commande, reçu, avis, visibilité, connexion).
2. Si tout va bien → fusionne la branche :
   ```powershell
   git checkout main
   git merge maintenance/AAAA-MM-JJ
   git push
   ```
3. Si quelque chose cloche → **on jette la branche** (rien n'est perdu sur main) :
   ```powershell
   git checkout main
   git branch -D maintenance/AAAA-MM-JJ
   ```
4. Regarde les **correctifs “sensibles” en attente** dans le rapport → envoie-les moi, on décide ensemble.

---

## 🗓️ RYTHME
- Lance cette commande **tous les 2 jours** (ou avant chaque mise à jour).
- Garde les fichiers `DIAGNOSTIC-*.md` et `MAINTENANCE-*.md` : ils montrent l'évolution de la santé de l'app dans le temps.

## 💡 POURQUOI C'EST SÛR
- **Branche dédiée** : les corrections n'arrivent sur `main` que si TU valides → l'app en prod n'est jamais cassée.
- **Checkpoint git** : retour arrière instantané.
- **Build vérifié** à chaque correctif : aucun commit ne casse l'app.
- **Sensible = ton accord** : aucune décision métier/risquée prise sans toi.
