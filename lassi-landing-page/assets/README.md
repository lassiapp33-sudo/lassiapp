# Dossier assets

Déposez ici les médias du portfolio (les conteneurs vides du site sont prêts à les recevoir).

## Fichiers attendus
- `CV-Lassana-Coulibaly.pdf` — le CV téléchargeable (bouton header + hero).
- `favicon.svg` — icône du site (déjà fournie).
- `og-cover.jpg` — image de partage (réseaux sociaux), 1200×630 px recommandé.

## Galerie « Réalisations »
Remplacez chaque conteneur `.media-frame` dans `index.html` par vos images/vidéos.

Exemple image :
```html
<figure class="tile media-frame">
  <img src="assets/projet-02.jpg" alt="Projet — identité visuelle" />
</figure>
```

Exemple vidéo :
```html
<figure class="tile tile--lg media-frame">
  <video src="assets/showreel.mp4" poster="assets/showreel.jpg" muted loop playsinline autoplay></video>
</figure>
```

Ajoutez dans `styles.css` si besoin :
```css
.tile img, .tile video { width:100%; height:100%; object-fit:cover; }
```

Formats conseillés : images `.webp`/`.jpg` (≤ 400 Ko), vidéos `.mp4` (H.264, ≤ 8 Mo) ou lien YouTube/Vimeo en iframe.
