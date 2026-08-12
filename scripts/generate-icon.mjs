/**
 * Génère icon.png et adaptive-icon.png depuis la source 2020×2020.
 * Crop-zoom centré sur le contenu pour agrandir le L et l'aiguille.
 * Aucune déformation — pure extraction + downscale haute qualité.
 */
import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SOURCE = 'C:/Users/USER/Desktop/LASSI/lassi-icon-FINALsan poi.png';
const OUT_ICON = join(__dirname, '../assets/icon.png');
const OUT_ADAPTIVE = join(__dirname, '../assets/adaptive-icon.png');
const OUT_PLAYSTORE = join(__dirname, '../assets/playstore.png');

// Source 2020×2020 — contenu centré à (1061, 939) mesuré sur le premier crop
// Crop 1050×1050 → zoom ×1.92 sur le L et l'aiguille, éléments ~50-55% du canvas
const CROP = 880;
const CX = 1061;
const CY = 939;

const left = CX - Math.floor(CROP / 2);   // 280
const top  = CY - Math.floor(CROP / 2);   // 290

console.log(`Crop: ${CROP}×${CROP} depuis (${left}, ${top}) dans la source 2020×2020`);

const pipeline = () =>
  sharp(SOURCE)
    .extract({ left, top, width: CROP, height: CROP });

await pipeline()
  .resize(1024, 1024, { kernel: 'lanczos3' })
  .png({ compressionLevel: 9 })
  .toFile(OUT_ICON);
console.log('✓ icon.png généré (1024×1024)');

await pipeline()
  .resize(1024, 1024, { kernel: 'lanczos3' })
  .png({ compressionLevel: 9 })
  .toFile(OUT_ADAPTIVE);
console.log('✓ adaptive-icon.png généré (1024×1024)');

await pipeline()
  .resize(512, 512, { kernel: 'lanczos3' })
  .png({ compressionLevel: 9 })
  .toFile(OUT_PLAYSTORE);
console.log('✓ playstore.png généré (512×512)');

console.log('\nTous les icônes ont été régénérés avec le L et l\'aiguille agrandis !');
