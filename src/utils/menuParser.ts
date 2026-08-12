export interface ParsedMenuItem {
  id: string;
  name: string;
  price: number | null;
}

// Prix FCFA : "2 500 FCFA", "2500 CFA", "800F", "2 500", "2500"
// Fourchette réaliste Dakar : 50 – 5 000 000 FCFA
const PRICE_AT_END = /(\d{1,3}(?:\s\d{3})*|\d{2,7})\s*(?:FCFA|CFA|[Ff]\b)?$/;
const MIN_PRICE = 50;
const MAX_PRICE = 5_000_000;

let _seq = 0;
const uid = () => `pm_${Date.now()}_${++_seq}`;

function parseLine(line: string): ParsedMenuItem | null {
  const match = line.match(PRICE_AT_END);

  if (match && match[1]) {
    const price = parseInt(match[1].replace(/\s/g, ''), 10);
    if (price >= MIN_PRICE && price <= MAX_PRICE) {
      const name = line.slice(0, match.index).trim().replace(/[-–:.…]+$/, '').trim();
      if (name.length >= 3) return { id: uid(), name, price };
    }
  }

  // Ligne sans prix reconnaissable — conservée si elle ressemble à un intitulé
  if (line.length >= 3 && line.length <= 80 && /[a-zàâäéèêëîïôùûüç]/i.test(line)) {
    return { id: uid(), name: line, price: null };
  }

  return null;
}

export function parseMenuText(rawText: string): ParsedMenuItem[] {
  return rawText
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length >= 3)
    .map(parseLine)
    .filter((item): item is ParsedMenuItem => item !== null);
}
