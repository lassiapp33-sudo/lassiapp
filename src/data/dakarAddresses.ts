// Base d'adresses Dakar — quartiers, marchés, hôpitaux, zones clés
// Coordonnées précises pour le calcul Haversine du devis livraison

export interface DakarAddress {
  id: string;
  label: string;          // Affiché dans la liste et dans l'input
  keywords: string[];     // Mots-clés supplémentaires pour la recherche
  zone: string;           // Ville / commune
  lat: number;
  lng: number;
}

// ─── Normalisation ────────────────────────────────────────────────────────────
// Supprime accents + met en minuscule pour une recherche insensible aux accents

export function normalizeAddr(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['-]/g, ' ')
    .trim();
}

export function searchAddresses(query: string, maxResults = 7): DakarAddress[] {
  if (query.length < 2) return [];
  const q = normalizeAddr(query);
  const words = q.split(/\s+/).filter(Boolean);
  return DAKAR_ADDRESSES.filter(addr => {
    const haystack = normalizeAddr(
      addr.label + ' ' + addr.zone + ' ' + addr.keywords.join(' '),
    );
    return words.every(w => haystack.includes(w));
  }).slice(0, maxResults);
}

// ─── Base d'adresses ──────────────────────────────────────────────────────────

export const DAKAR_ADDRESSES: DakarAddress[] = [

  // ══════════════════════════════════════════════════════════════════════
  // DAKAR — PLATEAU / CENTRE-VILLE
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'plateau-independance',
    label: 'Plateau — Place de l\'Indépendance',
    keywords: ['centre ville', 'mairie', 'ministere'],
    zone: 'Dakar',
    lat: 14.6693, lng: -17.4372,
  },
  {
    id: 'plateau-senghor',
    label: 'Plateau — Avenue Léopold Sédar Senghor',
    keywords: ['avenue senghor', 'centre commercial'],
    zone: 'Dakar',
    lat: 14.6720, lng: -17.4395,
  },
  {
    id: 'port-dakar',
    label: 'Port de Dakar',
    keywords: ['port autonome', 'terminal'],
    zone: 'Dakar',
    lat: 14.6648, lng: -17.4280,
  },
  {
    id: 'rebeuss',
    label: 'Rebeuss',
    keywords: ['prison rebeuss', 'avenue du colonel roux'],
    zone: 'Dakar',
    lat: 14.6740, lng: -17.4410,
  },
  {
    id: 'gueule-tapee',
    label: 'Gueule Tapée',
    keywords: ['fass', 'delorme'],
    zone: 'Dakar',
    lat: 14.6835, lng: -17.4462,
  },
  {
    id: 'fass-delorme',
    label: 'Fass Delorme',
    keywords: ['fass', 'gueule tapee'],
    zone: 'Dakar',
    lat: 14.6842, lng: -17.4447,
  },

  // ══════════════════════════════════════════════════════════════════════
  // DAKAR — MÉDINA
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'medina-tilene',
    label: 'Médina — Marché Tilène',
    keywords: ['tilene', 'marche medina'],
    zone: 'Dakar',
    lat: 14.6815, lng: -17.4513,
  },
  {
    id: 'medina-blaise-diagne',
    label: 'Médina — Avenue Blaise Diagne',
    keywords: ['blaise diagne', 'avenue'],
    zone: 'Dakar',
    lat: 14.6790, lng: -17.4490,
  },
  {
    id: 'medina-grand-dakar',
    label: 'Médina — Grand Dakar',
    keywords: ['grand dakar', 'medina'],
    zone: 'Dakar',
    lat: 14.6855, lng: -17.4520,
  },
  {
    id: 'colobane',
    label: 'Colobane — Marché Colobane',
    keywords: ['marche colobane', 'colobane'],
    zone: 'Dakar',
    lat: 14.6871, lng: -17.4543,
  },

  // ══════════════════════════════════════════════════════════════════════
  // DAKAR — FANN / POINT E / UNIVERSITÉ
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'fann-residence',
    label: 'Fann Résidence',
    keywords: ['fann', 'corniche', 'residence'],
    zone: 'Dakar',
    lat: 14.6871, lng: -17.4622,
  },
  {
    id: 'point-e',
    label: 'Point E',
    keywords: ['point e', 'fann', 'vdn'],
    zone: 'Dakar',
    lat: 14.6935, lng: -17.4633,
  },
  {
    id: 'ucad',
    label: 'UCAD — Université Cheikh Anta Diop',
    keywords: ['ucad', 'universite', 'campus', 'fann'],
    zone: 'Dakar',
    lat: 14.6942, lng: -17.4650,
  },
  {
    id: 'hopital-fann',
    label: 'Hôpital de Fann',
    keywords: ['chu fann', 'neurologie', 'hopital'],
    zone: 'Dakar',
    lat: 14.6922, lng: -17.4632,
  },
  {
    id: 'hopital-le-dantec',
    label: 'Hôpital Aristide Le Dantec',
    keywords: ['le dantec', 'hopital', 'chu'],
    zone: 'Dakar',
    lat: 14.6882, lng: -17.4522,
  },
  {
    id: 'hopital-principal',
    label: 'Hôpital Principal de Dakar',
    keywords: ['hopital principal', 'hp', 'militaire'],
    zone: 'Dakar',
    lat: 14.6712, lng: -17.4412,
  },

  // ══════════════════════════════════════════════════════════════════════
  // DAKAR — SICAP AMITIÉ
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'amitie-1',
    label: 'Sicap Amitié 1',
    keywords: ['amitie', 'sicap'],
    zone: 'Dakar',
    lat: 14.7031, lng: -17.4721,
  },
  {
    id: 'amitie-2',
    label: 'Sicap Amitié 2',
    keywords: ['amitie', 'sicap'],
    zone: 'Dakar',
    lat: 14.7062, lng: -17.4743,
  },
  {
    id: 'amitie-3',
    label: 'Sicap Amitié 3',
    keywords: ['amitie', 'sicap', 'rue 10'],
    zone: 'Dakar',
    lat: 14.7085, lng: -17.4760,
  },

  // ══════════════════════════════════════════════════════════════════════
  // DAKAR — SICAP LIBERTÉ
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'liberte-1',
    label: 'Sicap Liberté 1',
    keywords: ['liberte', 'sicap liberte'],
    zone: 'Dakar',
    lat: 14.7025, lng: -17.4738,
  },
  {
    id: 'liberte-2',
    label: 'Sicap Liberté 2',
    keywords: ['liberte', 'sicap liberte'],
    zone: 'Dakar',
    lat: 14.7055, lng: -17.4763,
  },
  {
    id: 'liberte-3',
    label: 'Sicap Liberté 3',
    keywords: ['liberte', 'sicap liberte'],
    zone: 'Dakar',
    lat: 14.7085, lng: -17.4778,
  },
  {
    id: 'liberte-4',
    label: 'Sicap Liberté 4',
    keywords: ['liberte', 'sicap liberte'],
    zone: 'Dakar',
    lat: 14.7105, lng: -17.4795,
  },
  {
    id: 'liberte-5',
    label: 'Sicap Liberté 5',
    keywords: ['liberte', 'sicap liberte'],
    zone: 'Dakar',
    lat: 14.7125, lng: -17.4810,
  },
  {
    id: 'liberte-6',
    label: 'Sicap Liberté 6',
    keywords: ['liberte 6', 'liberte six'],
    zone: 'Dakar',
    lat: 14.7145, lng: -17.4820,
  },
  {
    id: 'liberte-6-prolongee',
    label: 'Liberté 6 Prolongée',
    keywords: ['liberte 6 prolongee', 'patte oie'],
    zone: 'Dakar',
    lat: 14.7298, lng: -17.4705,
  },

  // ══════════════════════════════════════════════════════════════════════
  // DAKAR — SICAP DIEUPPEUL
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'dieuppeul-1',
    label: 'Sicap Dieuppeul 1',
    keywords: ['dieuppeul', 'sicap'],
    zone: 'Dakar',
    lat: 14.7108, lng: -17.4762,
  },
  {
    id: 'dieuppeul-2',
    label: 'Sicap Dieuppeul 2',
    keywords: ['dieuppeul', 'sicap'],
    zone: 'Dakar',
    lat: 14.7125, lng: -17.4775,
  },
  {
    id: 'dieuppeul-3',
    label: 'Sicap Dieuppeul 3',
    keywords: ['dieuppeul', 'sicap', 'derklé', 'derkle'],
    zone: 'Dakar',
    lat: 14.7148, lng: -17.4783,
  },

  // ══════════════════════════════════════════════════════════════════════
  // DAKAR — HLM
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'hlm-1',
    label: 'HLM 1',
    keywords: ['hlm', 'habitations loyer'],
    zone: 'Dakar',
    lat: 14.7052, lng: -17.4700,
  },
  {
    id: 'hlm-2',
    label: 'HLM 2',
    keywords: ['hlm'],
    zone: 'Dakar',
    lat: 14.7075, lng: -17.4712,
  },
  {
    id: 'hlm-4',
    label: 'HLM 4',
    keywords: ['hlm', 'marche hlm'],
    zone: 'Dakar',
    lat: 14.7120, lng: -17.4740,
  },
  {
    id: 'hlm-5',
    label: 'HLM 5',
    keywords: ['hlm'],
    zone: 'Dakar',
    lat: 14.7142, lng: -17.4758,
  },
  {
    id: 'hlm-grand-yoff',
    label: 'HLM Grand Yoff',
    keywords: ['hlm grand yoff', 'grand yoff'],
    zone: 'Dakar',
    lat: 14.7058, lng: -17.4685,
  },
  {
    id: 'hopital-hoggy',
    label: 'Hôpital HOGGY — Grand Yoff',
    keywords: ['hoggy', 'hopital grand yoff', 'gynecologie'],
    zone: 'Dakar',
    lat: 14.7052, lng: -17.4632,
  },

  // ══════════════════════════════════════════════════════════════════════
  // DAKAR — SACRÉ-CŒUR / MERMOZ
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'sacre-coeur-1',
    label: 'Sacré-Cœur 1',
    keywords: ['sacre coeur', 'vdn'],
    zone: 'Dakar',
    lat: 14.7062, lng: -17.4842,
  },
  {
    id: 'sacre-coeur-2',
    label: 'Sacré-Cœur 2',
    keywords: ['sacre coeur'],
    zone: 'Dakar',
    lat: 14.7082, lng: -17.4862,
  },
  {
    id: 'sacre-coeur-3',
    label: 'Sacré-Cœur 3',
    keywords: ['sacre coeur', 'cité keur gorgui'],
    zone: 'Dakar',
    lat: 14.7102, lng: -17.4882,
  },
  {
    id: 'mermoz',
    label: 'Mermoz',
    keywords: ['mermoz', 'sicap mermoz'],
    zone: 'Dakar',
    lat: 14.7132, lng: -17.4902,
  },
  {
    id: 'mermoz-pyrotechnie',
    label: 'Mermoz Pyrotechnie',
    keywords: ['pyrotechnie', 'mermoz'],
    zone: 'Dakar',
    lat: 14.7112, lng: -17.4882,
  },
  {
    id: 'sicap-baobabs',
    label: 'Sicap Baobabs',
    keywords: ['baobabs', 'sicap'],
    zone: 'Dakar',
    lat: 14.7202, lng: -17.4825,
  },

  // ══════════════════════════════════════════════════════════════════════
  // DAKAR — OUAKAM / ALMADIES / NGOR / YOFF
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'ouakam',
    label: 'Ouakam',
    keywords: ['ouakam', 'base aerienne'],
    zone: 'Dakar',
    lat: 14.7278, lng: -17.5042,
  },
  {
    id: 'ouakam-village',
    label: 'Ouakam Village',
    keywords: ['ouakam', 'village'],
    zone: 'Dakar',
    lat: 14.7252, lng: -17.5022,
  },
  {
    id: 'almadies',
    label: 'Almadies',
    keywords: ['almadies', 'vdn', 'pointe'],
    zone: 'Dakar',
    lat: 14.7452, lng: -17.5282,
  },
  {
    id: 'ngor',
    label: 'Ngor',
    keywords: ['ngor', 'virage ngor', 'aeroport'],
    zone: 'Dakar',
    lat: 14.7502, lng: -17.5222,
  },
  {
    id: 'ngor-village',
    label: 'Ngor Village',
    keywords: ['ngor', 'village', 'ile ngor'],
    zone: 'Dakar',
    lat: 14.7482, lng: -17.5252,
  },
  {
    id: 'yoff-village',
    label: 'Yoff Village',
    keywords: ['yoff', 'village', 'aeroport'],
    zone: 'Dakar',
    lat: 14.7552, lng: -17.4922,
  },
  {
    id: 'yoff-tound',
    label: 'Yoff Tound',
    keywords: ['yoff', 'tound'],
    zone: 'Dakar',
    lat: 14.7602, lng: -17.4902,
  },
  {
    id: 'yoff-virage',
    label: 'Yoff Virage',
    keywords: ['yoff', 'virage', 'front de terre'],
    zone: 'Dakar',
    lat: 14.7532, lng: -17.4982,
  },
  {
    id: 'patte-oie',
    label: 'Patte d\'Oie',
    keywords: ['patte oie', 'liberte'],
    zone: 'Dakar',
    lat: 14.7458, lng: -17.4703,
  },

  // ══════════════════════════════════════════════════════════════════════
  // DAKAR — PARCELLES ASSAINIES
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'parcelles-u1',
    label: 'Parcelles Assainies — Unité 1',
    keywords: ['parcelles', 'unite 1', 'pa'],
    zone: 'Dakar',
    lat: 14.7762, lng: -17.4652,
  },
  {
    id: 'parcelles-u3',
    label: 'Parcelles Assainies — Unité 3',
    keywords: ['parcelles', 'unite 3', 'pa'],
    zone: 'Dakar',
    lat: 14.7782, lng: -17.4632,
  },
  {
    id: 'parcelles-u5',
    label: 'Parcelles Assainies — Unité 5',
    keywords: ['parcelles', 'unite 5', 'pa'],
    zone: 'Dakar',
    lat: 14.7802, lng: -17.4612,
  },
  {
    id: 'parcelles-u7',
    label: 'Parcelles Assainies — Unité 7',
    keywords: ['parcelles', 'unite 7', 'pa'],
    zone: 'Dakar',
    lat: 14.7822, lng: -17.4592,
  },
  {
    id: 'parcelles-u10',
    label: 'Parcelles Assainies — Unité 10',
    keywords: ['parcelles', 'unite 10', 'pa'],
    zone: 'Dakar',
    lat: 14.7842, lng: -17.4572,
  },
  {
    id: 'parcelles-u15',
    label: 'Parcelles Assainies — Unité 15',
    keywords: ['parcelles', 'unite 15', 'pa'],
    zone: 'Dakar',
    lat: 14.7862, lng: -17.4552,
  },
  {
    id: 'parcelles-u17',
    label: 'Parcelles Assainies — Unité 17',
    keywords: ['parcelles', 'unite 17', 'pa'],
    zone: 'Dakar',
    lat: 14.7882, lng: -17.4542,
  },

  // ══════════════════════════════════════════════════════════════════════
  // DAKAR — GRAND YOFF / CAMBÉRÈNE
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'grand-yoff',
    label: 'Grand Yoff',
    keywords: ['grand yoff', 'marche grand yoff'],
    zone: 'Dakar',
    lat: 14.7452, lng: -17.4552,
  },
  {
    id: 'camberene',
    label: 'Cambérène',
    keywords: ['camberene', 'diamalaye'],
    zone: 'Dakar',
    lat: 14.7598, lng: -17.4348,
  },
  {
    id: 'marche-sandaga',
    label: 'Marché Sandaga',
    keywords: ['sandaga', 'marche', 'centre'],
    zone: 'Dakar',
    lat: 14.6712, lng: -17.4422,
  },
  {
    id: 'marche-castors',
    label: 'Marché des Castors',
    keywords: ['castors', 'marche'],
    zone: 'Dakar',
    lat: 14.7202, lng: -17.4802,
  },

  // ══════════════════════════════════════════════════════════════════════
  // GUÉDIAWAYE
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'gds-golf-sud',
    label: 'Guédiawaye — Golf Sud',
    keywords: ['golf sud', 'sam notaire', 'guediawaye'],
    zone: 'Guédiawaye',
    lat: 14.7950, lng: -17.4098,
  },
  {
    id: 'gds-golf-nord',
    label: 'Guédiawaye — Golf Nord',
    keywords: ['golf nord', 'guediawaye'],
    zone: 'Guédiawaye',
    lat: 14.7920, lng: -17.4145,
  },
  {
    id: 'gds-nimzat',
    label: 'Guédiawaye — Nimzat',
    keywords: ['nimzat', 'guediawaye'],
    zone: 'Guédiawaye',
    lat: 14.7892, lng: -17.4048,
  },
  {
    id: 'gds-wakhinane',
    label: 'Guédiawaye — Wakhinane Nimzat',
    keywords: ['wakhinane', 'nimzat', 'guediawaye'],
    zone: 'Guédiawaye',
    lat: 14.7872, lng: -17.4075,
  },
  {
    id: 'gds-ndiarem',
    label: 'Guédiawaye — Ndiarème Limamoulaye',
    keywords: ['ndiarem', 'limamoulaye', 'guediawaye'],
    zone: 'Guédiawaye',
    lat: 14.7832, lng: -17.4122,
  },
  {
    id: 'gds-sam-notaire',
    label: 'Guédiawaye — Sam Notaire',
    keywords: ['sam notaire', 'golf sud', 'guediawaye'],
    zone: 'Guédiawaye',
    lat: 14.7962, lng: -17.4018,
  },
  {
    id: 'gds-medine',
    label: 'Guédiawaye — Médine',
    keywords: ['medine', 'guediawaye'],
    zone: 'Guédiawaye',
    lat: 14.7902, lng: -17.4198,
  },
  {
    id: 'gds-roi-baudouin',
    label: 'Guédiawaye — Hôpital Roi Baudouin',
    keywords: ['roi baudouin', 'hopital', 'dalal diam', 'guediawaye'],
    zone: 'Guédiawaye',
    lat: 14.7852, lng: -17.4028,
  },
  {
    id: 'gds-dalal-diam',
    label: 'Guédiawaye — Hôpital Dalal Diam',
    keywords: ['dalal diam', 'hopital', 'guediawaye'],
    zone: 'Guédiawaye',
    lat: 14.7872, lng: -17.4052,
  },
  {
    id: 'gds-lansar',
    label: 'Guédiawaye — Lansar',
    keywords: ['lansar', 'guediawaye'],
    zone: 'Guédiawaye',
    lat: 14.7822, lng: -17.4048,
  },
  {
    id: 'gds-daroukhane',
    label: 'Guédiawaye — Daroukhane',
    keywords: ['daroukhane', 'guediawaye'],
    zone: 'Guédiawaye',
    lat: 14.7932, lng: -17.4248,
  },
  {
    id: 'gds-zinc',
    label: 'Guédiawaye — Marché Zinc',
    keywords: ['zinc', 'marche', 'guediawaye'],
    zone: 'Guédiawaye',
    lat: 14.7895, lng: -17.4075,
  },

  // ══════════════════════════════════════════════════════════════════════
  // PIKINE
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'pikine-ancien',
    label: 'Pikine Ancien',
    keywords: ['pikine', 'ancien'],
    zone: 'Pikine',
    lat: 14.7502, lng: -17.3902,
  },
  {
    id: 'pikine-extension',
    label: 'Pikine Extension',
    keywords: ['pikine', 'extension'],
    zone: 'Pikine',
    lat: 14.7552, lng: -17.3852,
  },
  {
    id: 'pikine-nord',
    label: 'Pikine Nord',
    keywords: ['pikine', 'nord'],
    zone: 'Pikine',
    lat: 14.7582, lng: -17.3892,
  },
  {
    id: 'pikine-icotaf',
    label: 'Pikine Icotaf',
    keywords: ['pikine', 'icotaf'],
    zone: 'Pikine',
    lat: 14.7482, lng: -17.3952,
  },
  {
    id: 'pikine-technopole',
    label: 'Pikine Technopole',
    keywords: ['technopole', 'pikine', 'zone franche'],
    zone: 'Pikine',
    lat: 14.7462, lng: -17.3982,
  },
  {
    id: 'yeumbeul-nord',
    label: 'Yeumbeul Nord',
    keywords: ['yeumbeul', 'nord', 'pikine'],
    zone: 'Pikine',
    lat: 14.7602, lng: -17.3702,
  },
  {
    id: 'yeumbeul-sud',
    label: 'Yeumbeul Sud',
    keywords: ['yeumbeul', 'sud', 'pikine'],
    zone: 'Pikine',
    lat: 14.7552, lng: -17.3752,
  },
  {
    id: 'thiaroye-mer',
    label: 'Thiaroye-sur-Mer',
    keywords: ['thiaroye', 'mer', 'plage', 'pikine'],
    zone: 'Pikine',
    lat: 14.7352, lng: -17.3852,
  },
  {
    id: 'thiaroye-gare',
    label: 'Thiaroye Gare',
    keywords: ['thiaroye', 'gare', 'pikine'],
    zone: 'Pikine',
    lat: 14.7402, lng: -17.3802,
  },
  {
    id: 'thiaroye-kao',
    label: 'Thiaroye Kao',
    keywords: ['thiaroye', 'kao', 'pikine'],
    zone: 'Pikine',
    lat: 14.7382, lng: -17.3822,
  },
  {
    id: 'diamaguene',
    label: 'Diamaguène Sicap Mbao',
    keywords: ['diamaguene', 'sicap mbao', 'pikine'],
    zone: 'Pikine',
    lat: 14.7302, lng: -17.3602,
  },
  {
    id: 'mbao',
    label: 'Mbao',
    keywords: ['mbao', 'pikine'],
    zone: 'Pikine',
    lat: 14.7252, lng: -17.3502,
  },
  {
    id: 'keur-massar',
    label: 'Keur Massar',
    keywords: ['keur massar', 'pikine'],
    zone: 'Pikine',
    lat: 14.7202, lng: -17.3302,
  },
  {
    id: 'keur-massar-nord',
    label: 'Keur Massar Nord',
    keywords: ['keur massar', 'nord', 'pikine'],
    zone: 'Pikine',
    lat: 14.7222, lng: -17.3282,
  },
  {
    id: 'jaxaay',
    label: 'Jaxaay',
    keywords: ['jaxaay', 'pikine', 'cite'],
    zone: 'Pikine',
    lat: 14.7152, lng: -17.3202,
  },

  // ══════════════════════════════════════════════════════════════════════
  // RUFISQUE
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'rufisque-centre',
    label: 'Rufisque Centre',
    keywords: ['rufisque', 'centre', 'marche rufisque'],
    zone: 'Rufisque',
    lat: 14.7163, lng: -17.2729,
  },
  {
    id: 'rufisque-est',
    label: 'Rufisque Est',
    keywords: ['rufisque', 'est'],
    zone: 'Rufisque',
    lat: 14.7198, lng: -17.2652,
  },
  {
    id: 'rufisque-nord',
    label: 'Rufisque Nord',
    keywords: ['rufisque', 'nord'],
    zone: 'Rufisque',
    lat: 14.7248, lng: -17.2698,
  },
  {
    id: 'rufisque-ouest',
    label: 'Rufisque Ouest',
    keywords: ['rufisque', 'ouest'],
    zone: 'Rufisque',
    lat: 14.7148, lng: -17.2778,
  },
  {
    id: 'bargny',
    label: 'Bargny',
    keywords: ['bargny', 'rufisque'],
    zone: 'Rufisque',
    lat: 14.7054, lng: -17.2298,
  },
  {
    id: 'sangalkam',
    label: 'Sangalkam',
    keywords: ['sangalkam', 'rufisque'],
    zone: 'Rufisque',
    lat: 14.7578, lng: -17.2922,
  },
  {
    id: 'hopital-youssou-mbargane',
    label: 'Rufisque — Hôpital Youssou Mbargane',
    keywords: ['hopital rufisque', 'youssou mbargane'],
    zone: 'Rufisque',
    lat: 14.7163, lng: -17.2750,
  },

  // ══════════════════════════════════════════════════════════════════════
  // THIÈS
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'thies-centre',
    label: 'Thiès Centre',
    keywords: ['thies', 'centre'],
    zone: 'Thiès',
    lat: 14.7905, lng: -16.9359,
  },
  {
    id: 'thies-nord',
    label: 'Thiès Nord',
    keywords: ['thies', 'nord', 'cite'],
    zone: 'Thiès',
    lat: 14.8002, lng: -16.9302,
  },
  {
    id: 'thies-camp-lat-dior',
    label: 'Thiès — Camp Lat Dior',
    keywords: ['thies', 'camp lat dior', 'quartier'],
    zone: 'Thiès',
    lat: 14.7852, lng: -16.9402,
  },
  {
    id: 'thies-hlm',
    label: 'Thiès HLM',
    keywords: ['thies', 'hlm'],
    zone: 'Thiès',
    lat: 14.7948, lng: -16.9342,
  },

  // ══════════════════════════════════════════════════════════════════════
  // MBOUR / SÉBIKOTANE
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'sebikotane',
    label: 'Sébikotane',
    keywords: ['sebikotane'],
    zone: 'Rufisque',
    lat: 14.7702, lng: -17.1402,
  },
  {
    id: 'mbour',
    label: 'Mbour Centre',
    keywords: ['mbour', 'petite cote'],
    zone: 'Mbour',
    lat: 14.3743, lng: -16.9658,
  },
];
