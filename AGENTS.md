# PROTOCOLE FIN DE SESSION — OBLIGATOIRE

Quand le travail est terminé, l'agent fait **exactement ceci** :

## Étape 1 — Commit (l'agent exécute)
```powershell
git add -A
git commit -m "fix(scope-reel): description-reelle"
git log --oneline -1
```

## Étape 2 — Afficher la commande OTA prête (l'agent affiche, N'EXÉCUTE PAS)

L'agent affiche ce bloc en fin de réponse, avec le vrai scope et la vraie description remplis :

```
Commande OTA à lancer quand tu es prêt :

1. git add -A
2. git commit -m "fix(scope-reel): description-reelle"
3. git log --oneline -1
4. .\ota-triple-publish.ps1 -Message "fix(scope-reel): description-reelle"

Depuis C:\Users\USER\Desktop\lassiapp\
```

## ⛔ RÈGLE ABSOLUE

L'agent **N'EXÉCUTE JAMAIS** `ota-triple-publish.ps1` ni `eas update`.
Il prépare la commande avec le bon scope → il attend que l'utilisateur la renvoie → alors seulement il l'exécute.

## ✅ RÈGLE D'ENGLOBER — JAMAIS ÉCRASER

Chaque OTA doit englober TOUS les fixes précédents.
Ceci est **automatiquement garanti** si :
1. Tous les fixes sont committés dans `lassiapp/` (branche master) AVANT l'OTA
2. L'OTA est lancé depuis `lassiapp/` avec `.\ota-triple-publish.ps1`

Le bundle capture le code COMPLET de `lassiapp/master` à ce moment.
Un agent qui travaille sur un fix ne touche PAS au code d'un autre fix — il commite le sien par-dessus.
**Ne jamais travailler depuis `Lassi/` — ce repo est obsolète et désynchronisé.**

---

# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v54.0.0/ before writing any code.

---

# OTA GUARDIAN — LIRE AVANT TOUT `eas update`

## Commande unique autorisée

```powershell
# Depuis C:\Users\USER\Desktop\lassiapp\   ← TOUJOURS ici, PAS depuis Lassi/
.\ota-triple-publish.ps1 -Message "fix(scope): description courte"
```

**Jamais de `eas update` direct. Jamais de push OTA hors de ce script.**

## Checklist obligatoire avant de lancer le script

1. `git status` — tous les fichiers modifiés sont committés
2. `git log --oneline -1` — le commit existe
3. Aucune autre session agent ne tourne en parallèle

## Pourquoi (causes des chaos 2026-10-04)

- `eas update --skip-bundler` lit le `app.config.js` COURANT pour le runtime version — si le linter le modifie pendant l'export (30-60s), l'OTA va sur le mauvais runtime
- Sessions parallèles → EAS sert le plus récent → elles s'écrasent
- OTA sans commit git → session suivante repart du vieux code → écrase les fixes
- OTA depuis `Lassi/` au lieu de `lassiapp/` → bundle l'ancien code de Lassi/ au lieu des commits récents → écrase les fixes

## Ce que fait le script

1. Export UNIQUE (bundle identique pour rt1.0.1/1.0.2/1.0.3)
2. Pour chaque runtime : `Set-Version $rt` → `eas update` immédiat (< 1s, linter ne peut pas intervenir)
3. Reset baseline `app.config.js` à `1.0.1`

## Interdit

- `eas update` en dehors de ce script
- Deux sessions qui poussent des OTAs en même temps
- OTA sans commit git préalable
- Lancer le script depuis `Lassi/` — toujours depuis `lassiapp/` (racine projet)
- `EAS_SKIP_AUTO_FINGERPRINT` absent (le script le set)
- `--branch production-1.0.x` (toujours `--branch production`)

## Runtimes prod

| APK | Runtime | Appareils |
|-----|---------|-----------|
| Build 1 | 1.0.1 | premiers testeurs |
| Build 2 | 1.0.2 | beta |
| Build 3 | 1.0.3 | store actuel |

**Baseline `app.config.js` = `1.0.1` — ne jamais laisser à 1.0.2 ou 1.0.3 après un OTA.**

Documentation complète : `Lassi/OTA_GUARDIAN.md`
