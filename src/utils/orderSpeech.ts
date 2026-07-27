import { IncomingOrder } from '../types/orders';
import { parseMultiBasketNote } from './basketNote';

/** Construit le texte lu à voix haute pour une commande (synthèse vocale). */
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
