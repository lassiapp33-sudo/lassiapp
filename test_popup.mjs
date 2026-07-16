/**
 * Test automatisé du popup PUBG-style de notification
 * Ouvre l'app web, injecte une notification dans le store Zustand, capture des screenshots.
 */
import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const APP_URL = 'http://localhost:8081';
const OUT_DIR = 'C:/Users/USER/Desktop/lassiapp/popup_test_screenshots';

fs.mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-web-security'],
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
});

const page = await browser.newPage();
page.setDefaultTimeout(20000);

// Capture les erreurs console
const consoleErrors = [];
page.on('console', msg => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});
page.on('pageerror', err => consoleErrors.push(err.message));

console.log('→ Ouverture de l\'app web…');
await page.goto(APP_URL, { waitUntil: 'networkidle', timeout: 30000 });

// Screenshot état initial
await page.screenshot({ path: `${OUT_DIR}/01_initial.png`, fullPage: false });
console.log('✅ Screenshot initial pris : 01_initial.png');

// Attendre que l'app soit rendue (splash screen puis auth ou home)
await page.waitForTimeout(3000);
await page.screenshot({ path: `${OUT_DIR}/02_apres_splash.png` });
console.log('✅ Screenshot après splash : 02_apres_splash.png');

// Injecter directement dans le store Zustand via window.__ZUSTAND__
// Expo React Native Web expose les stores via zustand's createStore
const result = await page.evaluate(() => {
  // Chercher le store dans les globals React
  // On va déclencher le store via un événement personnalisé
  // Zustand stores are not directly accessible, so we need to find them via React fiber

  // Méthode : utiliser React DevTools hook
  const root = document.getElementById('root') || document.getElementById('main');
  if (!root) return { error: 'no root element' };

  // Chercher les stores Zustand via le hook React
  const reactFiber = Object.keys(root).find(key => key.startsWith('__reactFiber'));
  if (!reactFiber) return { error: 'no React fiber found' };

  return { success: true, hasFiber: true };
});

console.log('React fiber check:', JSON.stringify(result));

// Essayer d'accéder au store via window
const storeTest = await page.evaluate(() => {
  // Dans React Native Web, les stores Zustand ne sont pas exposés sur window par défaut
  // Mais nous pouvons simuler via CustomEvent ou dispatching

  // Vérifier si le store est accessible quelque part
  const zustandKeys = Object.keys(window).filter(k =>
    k.includes('zustand') || k.includes('store') || k.includes('notif')
  );

  return {
    zustandKeys,
    hasWindow: typeof window !== 'undefined',
    location: window.location.href,
  };
});

console.log('Window globals:', JSON.stringify(storeTest));

// Puisque le store n'est pas exposé directement, on va injecter via eval dans le bundle
// En trouvant le module via webpack require (Expo bundler)
const injectionResult = await page.evaluate(() => {
  try {
    // Expo/Metro expose __r (require) et __d (define) en mode dev
    if (typeof __r === 'undefined') return { error: '__r (Metro require) non disponible' };

    // Chercher le module notifPopupStore dans le bundle
    // Les modules Metro ont des IDs numériques ou des chemins
    // On doit trouver le bon module ID

    // Alternative : chercher directement dans les modules chargés
    return { metroAvailable: true };
  } catch (e) {
    return { error: e.message };
  }
});

console.log('Metro require check:', JSON.stringify(injectionResult));

// Screenshot après 5 secondes pour voir si quelque chose change
await page.waitForTimeout(2000);
await page.screenshot({ path: `${OUT_DIR}/03_apres_2s.png` });

// Analyse des erreurs console
if (consoleErrors.length > 0) {
  console.log('\n⚠️  Erreurs console détectées:');
  consoleErrors.forEach(e => console.log('  ❌', e));
} else {
  console.log('\n✅ Aucune erreur console');
}

// Vérifier si l'app charge bien (pas d'écran blanc)
const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 200));
console.log('\nContenu visible:', bodyText.replace(/\n/g, ' ').substring(0, 100));

await browser.close();
console.log('\nScreenshots sauvegardés dans:', OUT_DIR);
