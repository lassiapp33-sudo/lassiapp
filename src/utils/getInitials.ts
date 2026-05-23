// Extrait l'initiale d'un nom complet : "Aïssatou Ndiaye" → "A"
export function getInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  return trimmed.charAt(0).toUpperCase();
}
