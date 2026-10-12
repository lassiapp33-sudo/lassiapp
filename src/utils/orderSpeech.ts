import { IncomingOrder } from '../types/orders';
import { parseMultiBasketNote } from './basketNote';

/** Texte court lu automatiquement à l'arrivée d'une commande (style Wave). */
export function buildOrderAlertAnnouncement(order: IncomingOrder): string {
  const itemsText = (() => {
    const parsed = parseMultiBasketNote(order.note);
    if (parsed) {
      return parsed.baskets
        .map(b => `${b.label} : ${b.items.replace(/ x(\d+)/g, ' fois $1')}`)
        .join(', ');
    }
    return order.items.map(i => `${i.qty > 1 ? i.qty + ' ' : ''}${i.name}`).join(', ');
  })();

  return `Commande reçue ! ${order.total} francs de ${order.clientName}. ${itemsText}.`;
}

/** Texte détaillé lu manuellement via le bouton play de la carte. */
export function buildOrderAnnouncement(order: IncomingOrder): string {
  const parsedBaskets = parseMultiBasketNote(order.note);
  const itemsText = parsedBaskets
    ? parsedBaskets.baskets
        .map(b => `${b.label} : ${b.items.replace(/ x(\d+)/g, ' fois $1')}`)
        .join('. ')
    : order.items.map(item => `${item.qty} ${item.name}`).join(', ');

  const payText = order.payMethod === 'wave' ? 'Wave' : 'Orange Money';

  const typeText =
    order.orderType === 'place'
      ? 'à consommer sur place'
      : order.orderType === 'emporter'
        ? 'à emporter'
        : '';

  return [
    `Commande numéro ${order.orderId.replace(/^#/, '')} de ${order.clientName}.`,
    `Articles : ${itemsText}.`,
    `Total : ${order.total} francs CFA, payé via ${payText}.`,
    typeText && `Commande ${typeText}.`,
  ]
    .filter(Boolean)
    .join(' ');
}
