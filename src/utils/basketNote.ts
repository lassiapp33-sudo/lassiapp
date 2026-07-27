export interface ParsedBasket {
  label: string;
  items: string; // ex: "Pain x2, Thon x1"
}

export interface ParsedMultiBasketNote {
  baskets: ParsedBasket[];
  userNote: string;
}

/**
 * Détecte et parse une note multi-panier générée par buildOrderNote.
 * Format: "Label A: item x2, item x1 | Label B: item x1"
 * Optionnel en fin: "\nNote: texte libre"
 * Retourne null si la note n'est pas au format multi-panier.
 */
export function parseMultiBasketNote(
  note: string | null | undefined,
): ParsedMultiBasketNote | null {
  if (!note) return null;

  let main = note;
  let userNote = '';

  const noteMarker = '\nNote: ';
  const noteIdx = note.indexOf(noteMarker);
  if (noteIdx !== -1) {
    main = note.slice(0, noteIdx);
    userNote = note.slice(noteIdx + noteMarker.length);
  }

  const parts = main.split(' | ');
  if (parts.length <= 1) return null;

  const baskets: ParsedBasket[] = [];
  for (const part of parts) {
    const colonIdx = part.indexOf(': ');
    if (colonIdx === -1) continue;
    baskets.push({
      label: part.slice(0, colonIdx),
      items: part.slice(colonIdx + 2),
    });
  }

  if (baskets.length <= 1) return null;

  return { baskets, userNote };
}
