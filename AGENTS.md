# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v54.0.0/ before writing any code.

---

# OTA GUARDIAN — LIRE AVANT TOUT `eas update`

## Commande unique autorisée

```powershell
# Depuis C:\Users\USER\Desktop\lassiapp\Lassi\
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

## Ce que fait le script

1. Export UNIQUE (bundle identique pour rt1.0.1/1.0.2/1.0.3)
2. Pour chaque runtime : `Set-Version $rt` → `eas update` immédiat (< 1s, linter ne peut pas intervenir)
3. Reset baseline `app.config.js` à `1.0.1`

## Interdit

- `eas update` en dehors de ce script
- Deux sessions qui poussent des OTAs en même temps
- OTA sans commit git préalable
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
