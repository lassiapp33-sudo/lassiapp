# OTA GUARDIAN — Règles absolues avant tout `eas update`

> **Consulter ce fichier AVANT chaque OTA. Sans exception.**

---

## Commande unique autorisée

```powershell
# Depuis C:\Users\USER\Desktop\lassiapp\Lassi\
.\ota-triple-publish.ps1 -Message "fix(scope): description courte"
```

**Jamais d'autre commande `eas update` directe.**

---

## Checklist obligatoire avant de lancer le script

- [ ] `git status` — tous les fichiers modifiés sont committés
- [ ] `git log --oneline -1` — le commit existe bien
- [ ] Aucune autre session agent ne tourne en parallèle sur ce projet

---

## Pourquoi ce script et pas autre chose

### Problème 1 — Le linter casse le runtime version
`eas update --skip-bundler` lit **le `app.config.js` courant** pour déterminer le runtime.
Si le linter modifie `app.config.js` pendant l'export (30-60s), l'OTA va sur le mauvais runtime.
**Fix dans le script** : `Set-Version` écrit la version et `eas update` démarre immédiatement (< 1s, linter n'a pas le temps).

### Problème 2 — Sessions parallèles qui s'écrasent
EAS sert l'OTA **le plus récent chronologiquement** par runtime.
Deux sessions qui poussent pour le même runtime → la dernière écrase l'autre.
**Fix** : 1 seul script, 1 seule session à la fois.

### Problème 3 — OTA sans commit git
La session suivante repart du git → repart du vieux code → son OTA écrase le tien avec l'ancienne version.
**Fix** : git commit AVANT le script, toujours.

---

## Ce que fait le script exactement

1. Export **une seule fois** (bundle identique pour les 3 runtimes)
2. Set version 1.0.1 → `eas update` immédiat → rt1.0.1 ✓
3. Set version 1.0.2 → `eas update` immédiat → rt1.0.2 ✓
4. Set version 1.0.3 → `eas update` immédiat → rt1.0.3 ✓
5. Reset baseline à 1.0.1

---

## Flow validé sur l'appareil (ADB logcat 2026-10-04)

```
StartStartup → Check → CheckCompleteAvailable → Download
→ DownloadComplete → Restart → reset (restartCount=1)
→ CheckCompleteUnavailable  ← appareil à jour
```

L'appareil applique les OTAs correctement. Les problèmes étaient 100% côté publication.

---

## Ce qui est interdit

- `eas update` en dehors de ce script
- Deux sessions qui poussent des OTAs en même temps
- OTA sans commit git préalable
- Modifier `app.config.js` manuellement pour changer la version (le script le fait)
- `EAS_SKIP_AUTO_FINGERPRINT` absent (le script le set)
