# Lassi Landing Page — Portfolio de Lassana Coulibaly

Landing page one-page — Digital Marketer, Designer Graphique & Motion Designer.
Site statique (HTML / CSS / JS), sans dépendance, prêt pour **GitHub Pages**.

Design repris à l'identique du template *Sokial* (structure, palette `#895DE8`,
typographies Inter + Manrope), contenu remplacé par le profil réel.

## Structure
```
lassi-landing-page/
├── index.html        # page complète
├── styles.css        # design system (couleurs + typo du template)
├── script.js         # nav, scroll, animations reveal
├── .nojekyll         # sert le site tel quel sur GitHub Pages
└── assets/
    ├── favicon.svg
    ├── CV-Lassana-Coulibaly.pdf
    └── README.md      # comment remplir la galerie (images / vidéos)
```

## Aperçu en local
Ouvrir `index.html` dans un navigateur, ou :
```bash
python -m http.server 5500
# puis http://localhost:5500
```

## Publier sur GitHub Pages
1. Créer un dépôt nommé **lassi-landing-page** sur le compte GitHub.
2. Depuis ce dossier :
   ```bash
   git init
   git add .
   git commit -m "Landing page portfolio"
   git branch -M main
   git remote add origin https://github.com/<utilisateur>/lassi-landing-page.git
   git push -u origin main
   ```
3. GitHub → **Settings → Pages** → Branch : `main` / `/ (root)` → Save.
4. Le site sera en ligne sur `https://<utilisateur>.github.io/lassi-landing-page/`.

## À compléter
- Galerie « Réalisations » : conteneurs vides à remplir (voir `assets/README.md`).
- Formulaire de contact : remplacer l'`action` par un ID **Formspree** (ou équivalent).
- Liens réseaux sociaux dans le footer.
- Un témoignage client réel dans la section dédiée.
