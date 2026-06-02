import { supabase }               from '../lib/supabase';
import { FAQ_ITEMS, FaqItem }       from '../data/faqData';
import { calcDistanceMeters }       from './shops';

// ─── Types ───────────────────────────────────────────────────────────────────

export type CatId = 'stores' | 'tangana' | 'food' | 'hair' | 'sport' | 'bakery' | 'fruiterie';

export interface CatMatch {
  id:    CatId;
  label: string;
}

export interface Intent {
  type:        'search' | 'faq' | 'salutation' | 'fallback';
  categorie?:  CatMatch;
  zone?:       string;
  faq?:        FaqItem;
  reponse?:    string;  // pour les salutations
}

// ─── Normalisation ────────────────────────────────────────────────────────────

export function normaliser(texte: string): string {
  return texte
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // supprime les diacritiques (é→e, à→a…)
    .replace(/[''`]/g, ' ')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── Salutations & personnalité Lassi ────────────────────────────────────────

const SALUTATIONS: { mots: string[]; rep: string }[] = [
  // Bonjour / bonsoir
  {
    mots: ['bonjour', 'bonsoir', 'bonne nuit', 'bonne matinee', 'good morning', 'good night', 'good evening'],
    rep: 'Bonjour ! 🐝 Je suis Lassi, ton assistante dans l\'app LASSİ ! Dis-moi ce que tu cherches — un commerce, une question sur l\'app — je suis là pour toi !',
  },
  // Salut / hello
  {
    mots: ['salut', 'coucou', 'hello', 'hi', 'hey', 'allo', 'wesh', 'yo', 'salam', 'assalamu alaykum', 'wa alaykum salam'],
    rep: 'Salut ! 🐝 Lassi est là. Je peux t\'aider à trouver un tangana, un coiffeur, un resto, ou répondre à tes questions sur l\'app. Qu\'est-ce qu\'il te faut ?',
  },
  // Comment ça va
  {
    mots: ['ca va', 'comment tu vas', 'comment vas tu', 'tu vas bien', 'comment ca va', 'tu vas comment', 'comment vous allez', 'la forme', 'bien ou'],
    rep: 'Je vais super bien, merci ! 🐝 Toujours prête à t\'aider à trouver les meilleurs commerces de Dakar. Et toi, qu\'est-ce qu\'il te faut ?',
  },
  // Qui es-tu / présentation
  {
    mots: ['qui es tu', 'qui es-tu', 'c est qui', 'tu es qui', 't es qui', 'ton nom', 'tu t appelles', 'tu t\'appelles', 'tu es quoi', 'tu fais quoi', 'c est quoi lassi', 'lassi c est qui', 'tu sers a quoi', 'ton role'],
    rep: 'Je suis Lassi 🐝, l\'abeille assistante de l\'app LASSİ ! Mon rôle : te guider pour trouver les commerces de ton quartier (tangana, coiffeur, resto, sport...), répondre à tes questions sur l\'app et faciliter ta vie à Dakar. Je suis là 24h/24, demande-moi tout !',
  },
  // Présente-toi
  {
    mots: ['presente toi', 'présente toi', 'parle moi de toi', 'dis moi qui tu es', 'tu es lassi', 'c est lassi', 'lassi presente'],
    rep: 'Avec plaisir ! Je suis Lassi 🐝, l\'abeille mascotte de l\'app LASSİ — l\'app qui connecte les clients aux commerçants de quartier à Dakar. Je suis ton assistante : je trouve des commerces pour toi, je réponds à tes questions et j\'oriente vers le service client si besoin. Dis-moi ce que tu veux !',
  },
  // Merci
  {
    mots: ['merci', 'merci beaucoup', 'thank you', 'thanks', 'je te remercie', 'trop bien', 'c est gentil', 'vous etes genial', 'tu es genial'],
    rep: 'Avec plaisir ! 🐝 C\'est exactement fait pour ça. Tu as besoin d\'autre chose ?',
  },
  // Au revoir
  {
    mots: ['au revoir', 'bye', 'a bientot', 'ciao', 'bonne journee', 'bonne soiree', 'bonne continuation', 'a plus', 'a tout a l heure', 'a demain', 'tchao'],
    rep: 'À très bientôt ! 🐝 N\'hésite pas à revenir quand tu as besoin. Passe une excellente journée !',
  },
  // Aide générale
  {
    mots: ['aide moi', 'j ai besoin d aide', 'j ai besoin', 'help me', 'je comprends pas', 'je ne comprends pas', 'comment ca marche', 'comment fonctionne', 'explique moi'],
    rep: 'Bien sûr, je suis là ! 🐝 Je peux :\n• Trouver un commerce (tangana, coiffeur, resto, sport...)\n• Répondre à tes questions sur l\'app\n• T\'orienter vers le service client\nDis-moi ce qu\'il te faut !',
  },
  // Wolof
  {
    mots: ['nanga def', 'na nga def', 'naka nga def', 'fogg', 'maangi fi', 'jamma', 'nanu dem', 'wa ngi fi', 'mbaa nga sant', 'fanaan'],
    rep: 'Mangi fi rekk ! 🐝 Maa ngi Lassi, ci biir app LASSİ bi. Dinaa la jàppandikoo — ci tangana, coiffeur, resto... walla ci questions yi ci app bi. Lii mooy la soxor ?',
  },
  // Compliments
  {
    mots: ['tu es belle', 't es belle', 'tu es top', 't es top', 'j aime lassi', 'lassi est super', 'bien lassi', 'j adore lassi', 'tu es la meilleure', 'trop fort', 'incroyable'],
    rep: 'Oh, tu es trop gentil(le) ! 🐝 Ça me fait chaud au cœur. Je ferai tout pour être à la hauteur. En quoi puis-je t\'aider ?',
  },
  // Humour / taquinerie
  {
    mots: ['t es une ia', 'tu es une ia', 't es un robot', 'tu es un robot', 'tu es humain', 't es humain', 'tu es reelle', 'tu es vraie'],
    rep: 'Je suis Lassi 🐝, une abeille très intelligente de l\'app LASSİ ! Pas tout à fait un robot, pas tout à fait humaine — juste là pour t\'aider du mieux possible. Alors, qu\'est-ce qu\'on fait ?',
  },
  // Test / ping
  {
    mots: ['test', 'tu marches', 'tu fonctionnes', 'tu m entends', 'tu es la', 'tu es là', 'allo lassi', 'lassi tu es la'],
    rep: 'Oui, je suis bien là ! 🐝 Prête à t\'aider. Dis-moi ce que tu cherches.',
  },
];

export function detecterSalutation(norm: string): string | null {
  for (const entry of SALUTATIONS) {
    for (const mot of entry.mots) {
      // match exact ou début de phrase
      if (norm === mot || norm.startsWith(mot + ' ') || norm.endsWith(' ' + mot) || norm.includes(' ' + mot + ' ')) {
        return entry.rep;
      }
      // courtes salutations : match si le mot = tout le texte normalisé
      if (mot.split(' ').length <= 2 && norm.trim() === mot) {
        return entry.rep;
      }
    }
  }
  return null;
}

// ─── Catégories (mots-clés → CatId) ──────────────────────────────────────────

const CATEGORY_MAP: { keywords: string[]; cat: CatMatch }[] = [
  {
    keywords: ['tangana', 'ndeki', 'ndekki', 'petit dej', 'petit dejeuner', 'cafe touba', 'mbourou', 'omelette', 'jus', 'bissap', 'bouye', 'gingembre', 'boisson', 'ditakh'],
    cat: { id: 'tangana', label: 'Tangana / Boissons' },
  },
  {
    keywords: ['restaurant', 'resto', 'manger', 'plat', 'dejeuner', 'diner', 'thieb', 'thieboudienne', 'yassa', 'mafe', 'dibiterie', 'dibi', 'viande grillee', 'mouton grille', 'serass', 'seras', 'soupe', 'fast food', 'burger', 'sandwich', 'shawarma', 'frites', 'fastfood', 'snack'],
    cat: { id: 'food', label: 'Restaurant' },
  },
  {
    keywords: ['coiffeur', 'barbier', 'coupe homme', 'degrade', 'coiffeuse', 'tresses', 'meches', 'defrisage', 'salon femme', 'nattes', 'ongles', 'manucure', 'pedicure', 'esthetique', 'maquillage', 'henne'],
    cat: { id: 'hair', label: 'Coiffeur / Esthétique' },
  },
  {
    keywords: ['boutique', 'alimentation', 'epicerie', 'riz', 'sucre', 'huile', 'lait', 'savon', 'gaz', 'quincaillerie', 'ciment', 'fer', 'peinture', 'clou', 'outil', 'brique', 'vis', 'commercant'],
    cat: { id: 'stores', label: 'Boutique / Quincaillerie' },
  },
  {
    keywords: ['salle de sport', 'muscu', 'musculation', 'fitness', 'gym', 'karate', 'judo', 'taekwondo', 'lutte', 'boxe', 'arts martiaux', 'zumba', 'yoga', 'aerobic', 'sport'],
    cat: { id: 'sport', label: 'Fitness / Sport' },
  },
  {
    keywords: ['boulangerie', 'baguette', 'patisserie', 'gateau', 'tarte', 'croissant', 'pain'],
    cat: { id: 'bakery', label: 'Boulangerie / Pâtisserie' },
  },
  {
    keywords: ['fruiterie', 'fruit', 'fruits', 'fruits marines', 'mangue', 'banane', 'ananas', 'papaye', 'goyave', 'citron', 'orange', 'pomme', 'melon', 'pasteque', 'fruits frais'],
    cat: { id: 'fruiterie', label: 'Fruiterie' },
  },
];

// ─── Quartiers connus ─────────────────────────────────────────────────────────

const QUARTIERS_CONNUS = [
  'patte d oie', 'patte doie', 'grand dakar', 'medina', 'plateau', 'yoff', 'ouakam', 'ngor',
  'almadies', 'parcelles assainies', 'parcelles', 'pikine', 'guediawaye', 'grand yoff',
  'sicap', 'liberte', 'hlm', 'fann', 'point e', 'mermoz', 'sacre coeur', 'dieuppeul',
  'castors', 'colobane', 'fass', 'gueule tapee', 'hann', 'thiaroye', 'keur massar',
  'mbao', 'bargny', 'rufisque', 'sebikotane', 'diamniadio', 'camberene', 'golf',
  'nord foire', 'sud foire', 'khar yalla', 'thies', 'saint louis', 'mbour', 'touba', 'ziguinchor',
];

// ─── Détection ────────────────────────────────────────────────────────────────

export function detecterCategorie(norm: string): CatMatch | null {
  // Cherche le match avec le plus de mots-clés trouvés
  let best: { cat: CatMatch; score: number } | null = null;

  for (const entry of CATEGORY_MAP) {
    for (const kw of entry.keywords) {
      if (norm.includes(kw)) {
        const score = kw.split(' ').length;
        if (!best || score > best.score) {
          best = { cat: entry.cat, score };
        }
      }
    }
  }
  return best ? best.cat : null;
}

export function detecterQuartier(norm: string): string | undefined {
  for (const q of QUARTIERS_CONNUS) {
    if (norm.includes(q)) {
      // Retourne la version originale (re-capitalise)
      return q.replace(/\b\w/g, c => c.toUpperCase());
    }
  }
  return undefined;
}

// ─── Routeur d'intention ──────────────────────────────────────────────────────

export function analyserMessage(
  texte:     string,
  _profil:   'client' | 'prestataire' | 'tous',
  _position: { lat: number; lng: number } | null,
): Intent {
  const norm = normaliser(texte);

  // 1. Recherche prestataire
  const cat = detecterCategorie(norm);
  if (cat) {
    const zone = detecterQuartier(norm);
    return { type: 'search', categorie: cat, zone };
  }

  // 2. Salutation / personnalité Lassi
  const salRep = detecterSalutation(norm);
  if (salRep) return { type: 'salutation', reponse: salRep };

  // 3. FAQ — toujours 'tous', pas de distinction client/prestataire
  const faq = rechercherFAQ(norm, 'tous');
  if (faq) return { type: 'faq', faq };

  // 4. Fallback
  return { type: 'fallback' };
}

// ─── Recherche FAQ ────────────────────────────────────────────────────────────

export function rechercherFAQ(
  normOuTexte: string,
  _profil?:    'client' | 'prestataire' | 'tous',
): FaqItem | null {
  const norm = normaliser(normOuTexte);
  let bestScore = 0;
  let bestItem: FaqItem | null = null;

  for (const item of FAQ_ITEMS) {
    // Plus de filtrage par profil — tout le monde voit toutes les réponses

    let score = 0;
    for (const kw of item.motsCles) {
      const kwNorm = normaliser(kw);
      if (norm.includes(kwNorm)) {
        score += kwNorm.split(' ').length;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestItem  = item;
    }
  }

  return bestScore >= 1 ? bestItem : null;
}

// ─── Recherche prestataires Supabase ─────────────────────────────────────────

export interface ShopResult {
  id:          string;
  name:        string;
  category:    string;
  zone:        string;
  logoUrl:     string | null;
  isOpen:      boolean;
  isVip:       boolean;
  rating:      number;
  latitude:    number | null;
  longitude:   number | null;
  distance?:   number;
}

function rowToResult(row: Record<string, any>): ShopResult {
  const now = new Date();
  const isVip =
    Boolean(row.is_vip) ||
    (row.vip_manual === true &&
      (row.vip_manual_until == null || new Date(row.vip_manual_until) > now));

  return {
    id:        row.id,
    name:      row.name,
    category:  row.category,
    zone:      row.zone ?? '',
    logoUrl:   row.logo_url ?? null,
    isOpen:    Boolean(row.is_open),
    isVip,
    rating:    Number(row.rating ?? 0),
    latitude:  row.latitude ?? null,
    longitude: row.longitude ?? null,
  };
}

export async function rechercherPrestataires(
  categorieId: string,
  zone:        string | undefined,
  position:    { lat: number; lng: number } | null,
): Promise<ShopResult[]> {
  let query = supabase
    .from('shops')
    .select('id,name,category,zone,logo_url,is_open,is_vip,vip_manual,vip_manual_until,rating,latitude,longitude')
    .eq('category', categorieId)
    .limit(20);

  if (zone) {
    query = query.ilike('zone', `%${zone}%`);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  let results = data.map(rowToResult);

  // Calcul distance si position disponible
  if (position) {
    results = results.map(s =>
      s.latitude != null && s.longitude != null
        ? { ...s, distance: calcDistanceMeters(position.lat, position.lng, s.latitude, s.longitude) }
        : s,
    );
  }

  // Tri : VIP → ouvert → distance/rating
  results.sort((a, b) => {
    if (a.isVip !== b.isVip)   return a.isVip  ? -1 : 1;
    if (a.isOpen !== b.isOpen) return a.isOpen  ? -1 : 1;
    if (a.distance != null && b.distance != null) return a.distance - b.distance;
    return b.rating - a.rating;
  });

  return results.slice(0, 8);
}

// ─── Logging questions sans réponse ──────────────────────────────────────────

export async function loggerQuestionSansReponse(texte: string): Promise<void> {
  try {
    await supabase
      .from('faq_misses')
      .insert({ question: texte.slice(0, 500) });
  } catch {
    // silent — table peut ne pas encore exister
  }
}
