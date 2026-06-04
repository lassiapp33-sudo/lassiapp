/** Formate un montant en FCFA : 1 500 F */
export function formatPrice(amount: number): string {
  return amount.toLocaleString('fr-FR') + ' F';
}

/** Formate une heure ISO en HH:MM */
export function formatTime(iso: string): string {
  const d = new Date(iso);
  return (
    d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0')
  );
}

/** Formate une date ISO en date courte fr-FR (ex : "3 juin") */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

/** Formate une date ISO en date longue fr-FR (ex : "3 juin 2025") */
export function formatDateLong(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Heure d'une conversation : HH:MM si < 24h, "Hier" si < 48h, date courte sinon.
 * Identique dans ClientMessagesScreen et MerchantMessagesScreen.
 */
export function formatConvTime(iso: string): string {
  const d = new Date(iso);
  const diffH = (Date.now() - d.getTime()) / 3_600_000;
  if (diffH < 24)
    return (
      d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0')
    );
  if (diffH < 48) return 'Hier';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

/** Formate une date ISO en JJ/MM/AAAA (utilisé pour les formulaires de promotion) */
export function formatDateDMY(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

/** Formate une date+heure ISO : "3 juin 2025 · 14:30" */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return (
    d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) +
    ' · ' +
    d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  );
}

/** Temps écoulé depuis un ISO : "à l'instant" / "il y a 5 min" / "il y a 2 h" / "il y a 3 j" */
export function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  const hours = Math.floor(diffMs / 3_600_000);
  const days = Math.floor(diffMs / 86_400_000);
  if (mins < 1) return "à l'instant";
  if (hours < 1) return `il y a ${mins} min`;
  if (days < 1) return `il y a ${hours} h`;
  return `il y a ${days} j`;
}
