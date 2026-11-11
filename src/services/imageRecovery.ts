import { Image } from 'expo-image';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';

// SHA-256 pur JS — utilisé pour calculer les clés de cache Glide (Android)
function sha256hex(str: string): string {
  const msg = unescape(encodeURIComponent(str));
  const bytes: number[] = [];
  for (let i = 0; i < msg.length; i++) bytes.push(msg.charCodeAt(i));
  const K = [
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2,
  ];
  let h0=0x6a09e667,h1=0xbb67ae85,h2=0x3c6ef372,h3=0xa54ff53a,h4=0x510e527f,h5=0x9b05688c,h6=0x1f83d9ab,h7=0x5be0cd19;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  const bitLen = (msg.length * 8);
  for (let i = 7; i >= 0; i--) bytes.push((bitLen / Math.pow(2, i * 8)) & 0xff);
  for (let chunk = 0; chunk < bytes.length; chunk += 64) {
    const w: number[] = [];
    for (let i = 0; i < 16; i++) w.push((bytes[chunk+i*4]<<24)|(bytes[chunk+i*4+1]<<16)|(bytes[chunk+i*4+2]<<8)|bytes[chunk+i*4+3]);
    for (let i = 16; i < 64; i++) {
      const s0 = (((w[i-15]>>>7)|(w[i-15]<<25))^((w[i-15]>>>18)|(w[i-15]<<14))^(w[i-15]>>>3))>>>0;
      const s1 = (((w[i-2]>>>17)|(w[i-2]<<15))^((w[i-2]>>>19)|(w[i-2]<<13))^(w[i-2]>>>10))>>>0;
      w.push((w[i-16]+s0+w[i-7]+s1)>>>0);
    }
    let [a,b,c,d,e,f,g,h] = [h0,h1,h2,h3,h4,h5,h6,h7];
    for (let i = 0; i < 64; i++) {
      const S1 = (((e>>>6)|(e<<26))^((e>>>11)|(e<<21))^((e>>>25)|(e<<7)))>>>0;
      const ch = ((e&f)^(~e&g))>>>0;
      const temp1 = (h+S1+ch+K[i]+w[i])>>>0;
      const S0 = (((a>>>2)|(a<<30))^((a>>>13)|(a<<19))^((a>>>22)|(a<<10)))>>>0;
      const maj = ((a&b)^(a&c)^(b&c))>>>0;
      const temp2 = (S0+maj)>>>0;
      [h,g,f,e,d,c,b,a] = [g,f,e,(d+temp1)>>>0,c,b,a,(temp1+temp2)>>>0];
    }
    h0=(h0+a)>>>0;h1=(h1+b)>>>0;h2=(h2+c)>>>0;h3=(h3+d)>>>0;
    h4=(h4+e)>>>0;h5=(h5+f)>>>0;h6=(h6+g)>>>0;h7=(h7+h)>>>0;
  }
  return [h0,h1,h2,h3,h4,h5,h6,h7].map(n=>n.toString(16).padStart(8,'0')).join('');
}

const RECOVERY_EF_URL = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1`;
const BATCH_SIZE = 2;
const MAX_FILE_BYTES = 3 * 1024 * 1024; // 3 MB max

interface BrokenProduct {
  product_id: string;
  original_url: string;
}

// Map url → product_id pour les produits cassés non récupérés (peuplée au démarrage)
const brokenUrlMap = new Map<string, string>();
const uploadingUrls = new Set<string>(); // anti-doublons
let cachedToken: string | null = null;

// Appelé depuis ProductTile/ProductRow quand une image se charge avec succès.
// Si l'URL est connue comme cassée, on la fetch immédiatement et on l'uploade.
export async function reportSuccessfulLoad(url: string): Promise<void> {
  if (!url || !brokenUrlMap.has(url) || uploadingUrls.has(url)) return;
  const productId = brokenUrlMap.get(url)!;
  uploadingUrls.add(url);
  try {
    const token = cachedToken ?? await getToken();
    if (!token) return;
    let base64: string | null = null;
    let mime = 'image/jpeg';

    // Stratégie 1 : lire depuis le cache expo-image (RESOURCE cache, disponible juste après onLoad)
    try {
      const cachePath = await Image.getCachePathAsync(url);
      if (cachePath) {
        const fileUri = cachePath.startsWith('file://') ? cachePath : `file://${cachePath}`;
        const info = await FileSystem.getInfoAsync(fileUri);
        if (info.exists) {
          const size = (info as any).size ?? 0;
          if (size >= 100 && size <= MAX_FILE_BYTES) {
            base64 = await FileSystem.readAsStringAsync(fileUri, { encoding: FileSystem.EncodingType.Base64 });
            const magic = base64?.slice(0, 4) ?? '';
            mime = magic === '/9j/' ? 'image/jpeg' : magic.startsWith('iVBO') ? 'image/png' : magic.startsWith('UklG') ? 'image/webp' : 'image/jpeg';
            console.log('[LASSI/onLoad] cache hit', productId.slice(-8), 'size=', size);
          }
        }
      }
    } catch { /* silencieux */ }

    // Stratégie 2 : réseau (fallback si cache inaccessible)
    if (!base64) {
      try {
        const netRes = await fetch(url);
        if (netRes.ok) {
          const blob = await netRes.blob();
          if (blob && blob.size >= 100 && blob.size <= MAX_FILE_BYTES) {
            base64 = await blobToBase64(blob);
            const ct = netRes.headers.get('content-type') ?? '';
            mime = ct.includes('png') ? 'image/png' : ct.includes('webp') ? 'image/webp' : 'image/jpeg';
          }
        }
      } catch { /* silencieux */ }
    }

    if (!base64 || base64.length < 100) return;
    const res = await fetch(`${RECOVERY_EF_URL}/recover-product-image`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_id: productId, image_base64: base64, mime_type: mime }),
    });
    const json = await res.json().catch(() => ({}));
    if (json.success) {
      brokenUrlMap.delete(url);
      // eslint-disable-next-line no-console
      console.log('[LASSI/recovery] onLoad rescued', productId.slice(-8));
    }
  } catch { /* silencieux */ } finally {
    uploadingUrls.delete(url);
  }
}

async function getToken(): Promise<string | null> {
  // Supabase charge la session depuis AsyncStorage de façon asynchrone au démarrage.
  // Si pas encore prête, on attend jusqu'à 10s (5 tentatives × 2s).
  for (let i = 0; i < 5; i++) {
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token) return data.session.access_token;
    if (i < 4) await new Promise(r => setTimeout(r, 2000));
  }
  return null;
}

async function fetchBrokenList(token: string, shopId?: string): Promise<BrokenProduct[]> {
  try {
    const url = shopId
      ? `${RECOVERY_EF_URL}/list-broken-products?shop_id=${shopId}`
      : `${RECOVERY_EF_URL}/list-broken-products`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return [];
    const json = await res.json();
    return json.products ?? [];
  } catch {
    return [];
  }
}

// Tente de récupérer une image UNIQUEMENT via le cache expo-image local (sans réseau)
// Retourne true si uploadé avec succès
async function tryRecoverFromCache(item: BrokenProduct, token: string, userId: string | null): Promise<boolean> {
  try {
    const localPath = await Image.getCachePathAsync(item.original_url);
    if (!localPath) return false;
    const fileUri = localPath.startsWith('file://') ? localPath : `file://${localPath}`;
    const info = await FileSystem.getInfoAsync(fileUri);
    if (!info.exists) return false;
    const size = (info as any).size ?? 0;
    if (size < 100 || size > MAX_FILE_BYTES) return false;

    let base64: string;
    if (Platform.OS === 'ios') {
      base64 = await FileSystem.readAsStringAsync(fileUri, { encoding: FileSystem.EncodingType.Base64 });
    } else {
      const fileRes = await fetch(fileUri);
      if (!fileRes.ok) return false;
      const blob = await fileRes.blob();
      if (!blob || blob.size < 100) return false;
      base64 = await blobToBase64(blob);
    }
    if (!base64 || base64.length < 100) return false;

    const magic = base64.slice(0, 4);
    const mime = magic === '/9j/' ? 'image/jpeg'
      : magic.startsWith('iVBO') ? 'image/png'
      : magic.startsWith('UklG') ? 'image/webp'
      : 'image/jpeg';

    const res = await fetch(`${RECOVERY_EF_URL}/recover-product-image`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_id: item.product_id, image_base64: base64, mime_type: mime, contributor_id: userId }),
    });
    const json = await res.json().catch(() => ({}));
    if (json.success) {
      brokenUrlMap.delete(item.original_url);
      console.log('[LASSI/cache] rescued', item.product_id.slice(-8), 'size=', size);
    }
    return json.success === true;
  } catch {
    return false;
  }
}

// Appelé depuis ShopScreen quand un shop s'ouvre — charge les produits cassés spécifiques à ce shop
// qui n'étaient peut-être pas dans la liste globale (au-delà de la page 1)
export async function registerShopForRecovery(shopId: string): Promise<void> {
  try {
    const token = cachedToken ?? await getToken();
    if (!token) return;
    if (!cachedToken) cachedToken = token;
    const shopBroken = await fetchBrokenList(token, shopId);
    let added = 0;
    for (const p of shopBroken) {
      if (!brokenUrlMap.has(p.original_url)) {
        brokenUrlMap.set(p.original_url, p.product_id);
        added++;
      }
    }
    if (added > 0) console.log('[LASSI/recovery] shop', shopId.slice(-8), 'added', added, 'new broken urls');
  } catch { /* silencieux */ }
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // strip "data:...;base64," prefix
      const b64 = result.split(',')[1] ?? '';
      resolve(b64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function tryRecoverOne(item: BrokenProduct, token: string, contributorId: string | null): Promise<boolean> {
  try {
    let base64: string | null = null;
    let mime = 'image/jpeg';

    // Stratégie 1 : fetch réseau direct (CDN encore chaud ou URL encore valide)
    try {
      const netRes = await fetch(item.original_url);
      if (netRes.ok) {
        const blob = await netRes.blob();
        if (blob && blob.size >= 100 && blob.size <= MAX_FILE_BYTES) {
          base64 = await blobToBase64(blob);
          const ct = netRes.headers.get('content-type') ?? '';
          if (ct.includes('png')) mime = 'image/png';
          else if (ct.includes('webp')) mime = 'image/webp';
        }
      }
    } catch { /* réseau indisponible */ }

    // Stratégie 2 : cache disque expo-image (Glide/SDWebImage)
    if (!base64) {
      const localPath = await Image.getCachePathAsync(item.original_url);
      if (localPath) {
        if (Platform.OS === 'ios') {
          const fileUri = localPath.startsWith('file://') ? localPath : `file://${localPath}`;
          const info = await FileSystem.getInfoAsync(fileUri);
          if (info.exists) {
            const size = (info as any).size ?? 0;
            if (size >= 100 && size <= MAX_FILE_BYTES) {
              base64 = await FileSystem.readAsStringAsync(fileUri, { encoding: FileSystem.EncodingType.Base64 });
            }
          }
        } else {
          const fileUri = localPath.startsWith('file://') ? localPath : `file://${localPath}`;
          const fileRes = await fetch(fileUri);
          if (fileRes.ok) {
            const blob = await fileRes.blob();
            if (blob && blob.size >= 100 && blob.size <= MAX_FILE_BYTES) {
              base64 = await blobToBase64(blob);
            }
          }
        }
      }
    }

    if (!base64 || base64.length < 100) return false;

    // Mime depuis URL si pas détecté via Content-Type
    const urlLower = item.original_url.toLowerCase();
    if (mime === 'image/jpeg') {
      if (urlLower.includes('.png')) mime = 'image/png';
      else if (urlLower.includes('.webp')) mime = 'image/webp';
    }

    // eslint-disable-next-line no-console
    console.log('[LASSI/recovery] uploading', item.product_id.slice(-8), 'b64len=', base64.length, 'mime=', mime);

    const res = await fetch(`${RECOVERY_EF_URL}/recover-product-image`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        product_id: item.product_id,
        image_base64: base64,
        mime_type: mime,
        contributor_id: contributorId,
      }),
    });

    const json = await res.json().catch(() => ({}));
    // eslint-disable-next-line no-console
    console.log('[LASSI/recovery] result', item.product_id.slice(-8), json.success, json.skipped);
    return json.success === true;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.log('[LASSI/recovery] error', item.product_id.slice(-8), String(err).slice(0, 80));
    return false;
  }
}

// Lit le cache Glide directement via FileSystem — contourne getCachePathAsync
// Calcule SHA-256(url) pour trouver le fichier correspondant dans image_manager_disk_cache
async function recoverFromGlideCache(broken: BrokenProduct[], token: string): Promise<number> {
  if (Platform.OS !== 'android') return 0;
  try {
    const glideDir = (FileSystem.cacheDirectory ?? '') + 'image_manager_disk_cache/';
    const info = await FileSystem.getInfoAsync(glideDir);
    if (!info.exists) return 0;
    const files = await FileSystem.readDirectoryAsync(glideDir);
    const fileSet = new Set(files);

    // DIAGNOSTIC: compare computed SHA-256 vs actual filenames
    const actualFiles = files.filter(f => f.endsWith('.0')).slice(0, 5);
    const sampleUrls = broken.slice(0, 3).map(b => ({ url: b.original_url.slice(-60), hash: sha256hex(b.original_url) + '.0' }));
    console.log('[LASSI/glide] actual_files=', actualFiles.join('|'));
    console.log('[LASSI/glide] computed_hashes=', sampleUrls.map(s => s.hash + '(' + s.url + ')').join('|'));
    console.log('[LASSI/glide] match_test=', sampleUrls.filter(s => fileSet.has(s.hash)).length, '/', sampleUrls.length);

    let recovered = 0;
    for (let i = 0; i < broken.length; i += BATCH_SIZE) {
      const batch = broken.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(batch.map(async (item) => {
        try {
          const hash = sha256hex(item.original_url);
          const filename = hash + '.0';
          if (!fileSet.has(filename)) return false;
          const filePath = glideDir + filename;
          const finfo = await FileSystem.getInfoAsync(filePath);
          const size = (finfo as any).size ?? 0;
          if (size < 100 || size > MAX_FILE_BYTES) return false;
          const base64 = await FileSystem.readAsStringAsync(filePath, { encoding: FileSystem.EncodingType.Base64 });
          if (!base64 || base64.length < 100) return false;
          // Détecter mime depuis magic bytes base64
          const magic = base64.slice(0, 4);
          const mime = magic === '/9j/' ? 'image/jpeg'
            : magic.startsWith('iVBO') ? 'image/png'
            : magic.startsWith('UklG') ? 'image/webp'
            : 'image/jpeg';
          // eslint-disable-next-line no-console
          console.log('[LASSI/glide] uploading', item.product_id.slice(-8), 'size=', size, 'mime=', mime);
          const res = await fetch(`${RECOVERY_EF_URL}/recover-product-image`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ product_id: item.product_id, image_base64: base64, mime_type: mime }),
          });
          const json = await res.json().catch(() => ({}));
          if (json.success) {
            brokenUrlMap.delete(item.original_url);
            // eslint-disable-next-line no-console
            console.log('[LASSI/glide] rescued', item.product_id.slice(-8));
          }
          return json.success === true;
        } catch { return false; }
      }));
      recovered += results.filter(Boolean).length;
    }
    // eslint-disable-next-line no-console
    console.log('[LASSI/glide] done', recovered, '/', broken.length);
    return recovered;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log('[LASSI/glide] error=', String(e).slice(0, 100));
    return 0;
  }
}

export async function runImageRecovery(): Promise<void> {
  try {
    const token = await getToken();
    if (!token) return;
    cachedToken = token;

    const broken = await fetchBrokenList(token);
    if (broken.length === 0) return;

    // Peupler la map pour onLoad intercept
    for (const p of broken) {
      if (!brokenUrlMap.has(p.original_url)) brokenUrlMap.set(p.original_url, p.product_id);
    }

    console.log('[LASSI/recovery] start', broken.length, 'broken products (page 1)');

    // Stratégie prioritaire Android : lire directement le cache Glide via SHA-256
    if (Platform.OS === 'android') {
      await recoverFromGlideCache(broken, token);
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id ?? null;

    let myProductIds = new Set<string>();
    if (userId) {
      // products.shop_id → shops.id (PAS le user id). On récupère d'abord les
      // boutiques du marchand, puis leurs produits, pour prioriser SES images
      // (son téléphone a le plus de chances d'avoir ses propres photos en cache).
      const { data: myShops } = await supabase.from('shops').select('id').eq('merchant_id', userId);
      const shopIds = (myShops ?? []).map((s: any) => s.id);
      if (shopIds.length > 0) {
        const { data: myProducts } = await supabase.from('products').select('id').in('shop_id', shopIds);
        myProductIds = new Set((myProducts ?? []).map((p: any) => p.id));
      }
    }

    // Phase 1 : scan cache expo-image pour les produits page 1 (mes produits en priorité)
    const stillBroken = broken.filter(p => brokenUrlMap.has(p.original_url));
    const prioritized = [
      ...stillBroken.filter(p => myProductIds.has(p.product_id)),
      ...stillBroken.filter(p => !myProductIds.has(p.product_id)),
    ];
    console.log('[LASSI/recovery] cache scan page1:', prioritized.length);
    let recovered = 0;
    for (let i = 0; i < prioritized.length; i += BATCH_SIZE) {
      const batch = prioritized.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(batch.map(p => tryRecoverOne(p, token, userId)));
      recovered += results.filter(Boolean).length;
    }
    console.log('[LASSI/recovery] page1 done', recovered, '/', prioritized.length);

    // Phase 2 : scan TOUTES les pages restantes via cache expo-image uniquement (en arrière-plan)
    // Fait en background — ne bloque pas l'UI
    scanAllPagesInBackground(token, userId).catch(() => {});
  } catch {
    // Silencieux — jamais crasher l'app
  }
}

async function scanAllPagesInBackground(token: string, userId: string | null): Promise<void> {
  try {
    // La page 1 (1000 produits) est déjà traitée — on commence à l'offset 1000
    const SCAN_BATCH = 5; // concurrent getCachePathAsync calls
    let offset = 1000;
    let totalRecovered = 0;

    while (true) {
      let res: Response;
      try {
        res = await fetch(
          `${RECOVERY_EF_URL}/list-broken-products?offset=${offset}&limit=200`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
      } catch { break; }
      if (!res.ok) break;
      const json = await res.json().catch(() => ({}));
      const page: BrokenProduct[] = json.products ?? [];
      if (page.length === 0) break;

      // Ajouter à brokenUrlMap
      for (const p of page) {
        if (!brokenUrlMap.has(p.original_url)) brokenUrlMap.set(p.original_url, p.product_id);
      }

      // Tenter récupération via cache local uniquement
      for (let i = 0; i < page.length; i += SCAN_BATCH) {
        const batch = page.slice(i, i + SCAN_BATCH);
        const results = await Promise.all(batch.map(p => tryRecoverFromCache(p, token, userId)));
        totalRecovered += results.filter(Boolean).length;
      }

      offset += page.length;
      if (page.length < 200) break;
      // Petite pause pour ne pas saturer
      await new Promise(r => setTimeout(r, 300));
    }
    console.log('[LASSI/recovery] background scan done, total rescued=', totalRecovered);
  } catch { /* silencieux */ }
}
