import { supabase } from "../supabase";
import { handleResponse } from "../apiHelpers";
import { AuditAPI } from "./audit";

function mapTicketTypeToDB(t) {
  return { event_id: t.eventId, name: t.name, description: t.description, price: t.price, currency: t.currency || "AED", capacity: t.capacity, is_active: t.isActive, is_full_event: t.isFullEvent };
}
function mapTicketTypeFromDB(db) {
  return { id: db.id, eventId: db.event_id, name: db.name, description: db.description, price: db.price, currency: db.currency, capacity: db.capacity, isActive: db.is_active, isFullEvent: db.is_full_event };
}
function mapTicketPackageToDB(p) {
  return { event_id: p.eventId, name: p.name, description: p.description, price: p.price, quantity_included: p.quantityIncluded, is_active: p.isActive, is_full_event: p.isFullEvent };
}
function mapTicketPackageFromDB(db) {
  return { id: db.id, eventId: db.event_id, name: db.name, description: db.description, price: db.price, quantityIncluded: db.quantity_included, isActive: db.is_active, isFullEvent: db.is_full_event };
}

export const TicketingAPI = {
  getTypes: async (eventId) => {
    const data = await handleResponse(
      () => supabase.from("ticket_types").select("*").eq("event_id", eventId).order("created_at", { ascending: true })
    );
    return (data || []).map(mapTicketTypeFromDB);
  },
  createType: async (type) => {
    const dbType = mapTicketTypeToDB(type);
    const data = await handleResponse(() => supabase.from("ticket_types").insert([dbType]).select().single());
    return mapTicketTypeFromDB(data);
  },
  updateType: async (id, updates) => {
    const dbUpdates = mapTicketTypeToDB(updates);
    delete dbUpdates.id;
    const data = await handleResponse(() => supabase.from("ticket_types").update(dbUpdates).eq("id", id).select().single());
    return mapTicketTypeFromDB(data);
  },
  deleteType: async (id) => {
    await handleResponse(() => supabase.from("ticket_types").delete().eq("id", id));
  },

  getPackages: async (eventId) => {
    const data = await handleResponse(
      () => supabase.from("ticket_packages").select("*").eq("event_id", eventId).order("created_at", { ascending: true })
    );
    return (data || []).map(mapTicketPackageFromDB);
  },
  createPackage: async (pkg) => {
    const dbPkg = mapTicketPackageToDB(pkg);
    const data = await handleResponse(() => supabase.from("ticket_packages").insert([dbPkg]).select().single());
    return mapTicketPackageFromDB(data);
  },
  updatePackage: async (id, updates) => {
    const dbUpdates = mapTicketPackageToDB(updates);
    delete dbUpdates.id;
    const data = await handleResponse(() => supabase.from("ticket_packages").update(dbUpdates).eq("id", id).select().single());
    return mapTicketPackageFromDB(data);
  },
  deletePackage: async (id) => {
    await handleResponse(() => supabase.from("ticket_packages").delete().eq("id", id));
  },

  getOrders: async (eventId) => {
    const data = await handleResponse(
      () => supabase.from("spectator_orders").select("*").eq("event_id", eventId).order("created_at", { ascending: false })
    );
    return data || [];
  },

  createOrder: async (order) => {
    const orderQrCodeId = order.qrCodeId || `ord_${Math.random().toString(36).substr(2, 9)}`;
    const dbOrder = {
      event_id: order.eventId,
      customer_name: order.customerName,
      customer_email: order.customerEmail,
      total_amount: order.totalAmount,
      ticket_count: order.ticketCount,
      payment_status: order.paymentStatus || 'pending',
      payment_provider: order.paymentProvider || 'stripe',
      qr_code_id: orderQrCodeId,
      scanned_count: 0,
      selected_dates: order.selectedDates || [],
      has_individual_tickets: true
    };

    const orderData = await handleResponse(() => supabase.from("spectator_orders").insert([dbOrder]).select().single());

    const ticketCount = order.ticketItems?.length || order.ticketCount || 0;
    let tickets = [];

    if (ticketCount > 0) {
      tickets = (order.ticketItems || []).map(item => ({
        order_id: orderData.id,
        ticket_code: `TKT-${orderData.qr_code_id.split('-')[1] || orderData.id.slice(0, 4).toUpperCase()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
        status: 'valid',
        ticket_name: item.name,
        price: item.price,
        valid_date: item.date
      }));

      const { error: insertErr } = await supabase.from("spectator_tickets").insert(tickets);
      if (insertErr && (insertErr.code === 'PGRST204' || insertErr.code === '42703')) {
        const safeTickets = tickets.map(t => ({
          order_id: t.order_id,
          ticket_code: t.ticket_code,
          status: `valid|${JSON.stringify({ n: t.ticket_name, p: t.price, d: t.valid_date })}`
        }));
        await handleResponse(() => supabase.from("spectator_tickets").insert(safeTickets));
        tickets = safeTickets;
      } else if (insertErr) throw insertErr;
    }

    return { ...orderData, tickets };
  },

  getRevenueStats: async (eventId) => {
    const rawOrders = await handleResponse(() => supabase.from("spectator_orders").select("*").eq("event_id", eventId));
    if (!rawOrders?.length) return { orders: [], tickets: [] };

    const orders = rawOrders.filter(o => o.payment_status === 'paid');
    if (!orders.length) return { orders: [], tickets: [] };

    const orderIds = orders.map(o => o.id);
    const tickets = [];
    const ID_CHUNK_SIZE = 100;

    for (let i = 0; i < orderIds.length; i += ID_CHUNK_SIZE) {
      const chunk = orderIds.slice(i, i + ID_CHUNK_SIZE);
      const data = await handleResponse(() => supabase.from("spectator_tickets").select("*").in("order_id", chunk));
      if (data) tickets.push(...data);
    }

    return {
      orders,
      tickets: tickets.map(t => ({ ...t, order: orders.find(o => o.id === t.order_id) }))
    };
  },

  validateOrder: async (token) => {
    const specificTicket = await handleResponse(
      () => supabase.from("spectator_tickets").select("*, spectator_orders(*)").eq("ticket_code", token).maybeSingle()
    ).catch(() => null);

    if (specificTicket) {
      const orderData = Array.isArray(specificTicket.spectator_orders) ? specificTicket.spectator_orders[0] : specificTicket.spectator_orders;
      return { ...orderData, specific_ticket: specificTicket };
    }

    return handleResponse(() => supabase.from("spectator_orders").select("*").eq("qr_code_id", token).maybeSingle());
  },

  redeemTickets: async (orderId, count, ticketId = null) => {
    const ords = await handleResponse(() => supabase.from('spectator_orders').select('*').eq('id', orderId).limit(1));
    const order = ords?.[0];
    if (!order) throw new Error("Invalid Order or Ticket Code");

    const evs = await handleResponse(() => supabase.from('events').select('timezone').eq('id', order.event_id).limit(1));
    const eventTz = evs?.[0]?.timezone || "UTC";
    const today = new Date().toLocaleDateString('en-CA', { timeZone: eventTz });

    if (ticketId) {
      try {
        return await handleResponse(() =>
          supabase.rpc('redeem_ticket_transaction', {
            p_ticket_id: ticketId,
            p_order_id: orderId,
            p_today_date: today
          })
        );
      } catch (err) {
        const msg = err.message || String(err);
        throw new Error(msg.includes("ALREADY_SCANNED") ? "ALREADY_SCANNED" : msg);
      }
    }

    const newScannedTotal = (order.scanned_count || 0) + Number(count);
    if (newScannedTotal > order.ticket_count) throw new Error("Limit exceeded");

    await handleResponse(() => supabase.from("spectator_orders").update({ scanned_count: newScannedTotal, last_scan_at: new Date().toISOString() }).eq("id", orderId));
    return { ...order, scanned_count: newScannedTotal };
  },

  recordGenericEntry: async (eventId, guestName, deviceLabel) => {
    AuditAPI.log("generic_pass_scan", {
      eventId, guestName,
      deviceLabel: deviceLabel || "Generic Gate",
      timestamp: new Date().toISOString()
    });
    return true;
  }
};
