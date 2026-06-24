// ============================================================================
// pricing — pure server-side price authority for create-payment-session
//
// Extracted verbatim from create-payment-session/index.ts so the Stripe
// line-item math is unit-testable without Stripe or Supabase. index.ts fetches
// the authoritative rows from the database and passes them in here; this module
// NEVER trusts a client-supplied amount/price — that is the whole point of the
// "server-side price authority" control (see docs/SECURITY.md §Payments).
//
// Behaviour here must stay identical to the inline logic it replaced; the tests
// in pricing.test.ts pin that contract.
// ============================================================================

const CURRENCY = "aed";

export interface StripeLineItem {
  price_data: {
    currency: string;
    product_data: { name: string; description: string };
    unit_amount: number;
  };
  quantity: number;
}

export interface InviteLink {
  token?: string;
  requirePayment?: boolean;
  paymentAmount?: number | string;
}

export interface PriceRow {
  price: number;
  isFullEvent: boolean;
}

export interface TicketRow {
  id: string;
  price: number | string;
  is_full_event?: boolean;
}

export interface SpectatorItem {
  id: string;
  name?: string;
  description?: string;
  quantity?: number | string;
  dayFactor?: number | string;
}

/**
 * Accreditation fee: the amount comes only from the invite-link configuration
 * (server-controlled). Throws if the link does not require payment.
 */
export function computeAccreditationLineItems(
  link: InviteLink,
  ctx: { eventSlug?: string; customerName?: string },
): StripeLineItem[] {
  const serverAmount = link.requirePayment ? Number(link.paymentAmount) : 0;
  if (!serverAmount || serverAmount <= 0) {
    throw new Error("This registration does not require payment");
  }
  return [
    {
      price_data: {
        currency: CURRENCY,
        product_data: {
          name: `Accreditation Fee - ${ctx.eventSlug}`,
          description: `Registration fee for ${ctx.customerName}`,
        },
        unit_amount: Math.round(serverAmount * 100),
      },
      quantity: 1,
    },
  ];
}

/**
 * Build the authoritative id -> {price, isFullEvent} map from the DB rows.
 * Client-supplied prices are never entered here.
 */
export function buildPriceMap(
  ticketTypes: TicketRow[] | null,
  ticketPackages: TicketRow[] | null,
): Map<string, PriceRow> {
  const priceMap = new Map<string, PriceRow>();
  for (const t of ticketTypes || []) {
    priceMap.set(t.id, { price: Number(t.price), isFullEvent: !!t.is_full_event });
  }
  for (const p of ticketPackages || []) {
    priceMap.set(p.id, { price: Number(p.price), isFullEvent: !!p.is_full_event });
  }
  return priceMap;
}

/**
 * Spectator tickets: re-price every requested item from the authoritative map.
 * Quantity is clamped to [1,100] and the per-day factor to [1,60] (full-event
 * tickets ignore the day factor). Unknown item ids are rejected.
 */
export function buildSpectatorLineItems(
  items: SpectatorItem[],
  priceMap: Map<string, PriceRow>,
): StripeLineItem[] {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("No items provided");
  }
  return items.map((item) => {
    const dbItem = priceMap.get(item.id);
    if (!dbItem) {
      throw new Error(`Unknown ticket item: ${item.id}`);
    }

    const quantity = Math.max(1, Math.min(100, parseInt(String(item.quantity), 10) || 1));
    const dayFactor = dbItem.isFullEvent
      ? 1
      : Math.max(1, Math.min(60, parseInt(String(item.dayFactor), 10) || 1));
    const unitAmount = Math.round(dbItem.price * dayFactor * 100);

    return {
      price_data: {
        currency: CURRENCY,
        product_data: {
          name: item.name || "Ticket",
          description: item.description || "",
        },
        unit_amount: unitAmount,
      },
      quantity,
    };
  });
}
