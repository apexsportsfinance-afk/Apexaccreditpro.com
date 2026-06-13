import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@12.0.0?target=deno'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2022-11-15',
  httpClient: Stripe.createFetchHttpClient(),
})

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const supabase = createClient(supabaseUrl, supabaseServiceKey)

// [APX-SEC] CORS allow-list. Add production domains via the ALLOWED_ORIGINS
// env var (comma-separated) instead of widening this default list.
const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:5180',
  'http://localhost:5173',
  'https://accreditation.apexsports.ae',
]
const extraOrigins = (Deno.env.get('ALLOWED_ORIGINS') ?? '').split(',').map((o) => o.trim()).filter(Boolean)
const ALLOWED_ORIGINS = new Set([...DEFAULT_ALLOWED_ORIGINS, ...extraOrigins])

function buildCorsHeaders(origin: string | null) {
  const allowOrigin = origin && ALLOWED_ORIGINS.has(origin) ? origin : DEFAULT_ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  }
}

serve(async (req) => {
  const requestOrigin = req.headers.get('origin')
  const corsHeaders = buildCorsHeaders(requestOrigin)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { type, eventId, eventSlug, items, customerEmail, customerName, metadata } = await req.json()

    console.log(`Creating ${type} payment session for ${customerEmail}`);

    let lineItems = []
    let sessionMetadata: any = {
      type,
      eventId,
      eventSlug,
      customerEmail,
      customerName,
      ...metadata
    }

    if (type === 'accreditation') {
      // [APX-SEC] Server-side price authority: the fee is looked up from the
      // invite link configuration. The client-supplied metadata.amount is
      // never trusted for the actual charge amount.
      const token = metadata?.token
      if (!token) {
        throw new Error('Missing invite token; cannot determine accreditation fee')
      }

      const { data: settingsRow, error: settingsError } = await supabase
        .from('global_settings')
        .select('value')
        .eq('key', `event_${eventId}_invite_links`)
        .single()

      if (settingsError || !settingsRow?.value) {
        throw new Error('Unable to load invite link configuration')
      }

      const links = typeof settingsRow.value === 'string' ? JSON.parse(settingsRow.value) : settingsRow.value
      const link = Array.isArray(links) ? links.find((l: any) => l.token === token) : null

      if (!link) {
        throw new Error('Invalid invite token')
      }

      const serverAmount = link.requirePayment ? Number(link.paymentAmount) : 0
      if (!serverAmount || serverAmount <= 0) {
        throw new Error('This registration does not require payment')
      }

      lineItems = [{
        price_data: {
          currency: 'aed',
          product_data: {
            name: `Accreditation Fee - ${eventSlug}`,
            description: `Registration fee for ${customerName}`,
          },
          unit_amount: Math.round(serverAmount * 100),
        },
        quantity: 1,
      }]
    } else if (type === 'spectator') {
      if (!Array.isArray(items) || items.length === 0) {
        throw new Error('No items provided')
      }

      // [APX-SEC] Server-side price authority: re-fetch authoritative prices
      // for the requested ticket types / packages. Client-supplied item.price
      // is never trusted for the actual charge amount.
      const [{ data: ticketTypes }, { data: ticketPackages }] = await Promise.all([
        supabase.from('ticket_types').select('id, price, is_full_event').eq('event_id', eventId),
        supabase.from('ticket_packages').select('id, price, is_full_event').eq('event_id', eventId),
      ])

      const priceMap = new Map<string, { price: number; isFullEvent: boolean }>()
      for (const t of ticketTypes || []) priceMap.set(t.id, { price: Number(t.price), isFullEvent: !!t.is_full_event })
      for (const p of ticketPackages || []) priceMap.set(p.id, { price: Number(p.price), isFullEvent: !!p.is_full_event })

      lineItems = items.map((item: any) => {
        const dbItem = priceMap.get(item.id)
        if (!dbItem) {
          throw new Error(`Unknown ticket item: ${item.id}`)
        }

        const quantity = Math.max(1, Math.min(100, parseInt(item.quantity, 10) || 1))
        const dayFactor = dbItem.isFullEvent ? 1 : Math.max(1, Math.min(60, parseInt(item.dayFactor, 10) || 1))
        const unitAmount = Math.round(dbItem.price * dayFactor * 100)

        return {
          price_data: {
            currency: 'aed',
            product_data: {
              name: item.name || 'Ticket',
              description: item.description || '',
            },
            unit_amount: unitAmount,
          },
          quantity,
        }
      })
    } else {
      throw new Error('Invalid payment type')
    }

    // Determine redirect base
    const origin = requestOrigin || DEFAULT_ALLOWED_ORIGINS[0]
    let redirectPath = `/${type === 'accreditation' ? 'register' : 'tickets'}/${eventSlug}`
    if (type === 'accreditation' && metadata?.token) {
      redirectPath += `/invite/${metadata.token}`
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      customer_email: customerEmail,
      success_url: `${origin}${redirectPath}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}${redirectPath}?error=cancelled&record_id=${metadata?.accreditationRecordId || ''}`,
      metadata: sessionMetadata,
    })

    console.log(`Session created: ${session.id}`);
    return new Response(JSON.stringify({ url: session.url, id: session.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error(`Error creating session: ${error.message}`);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
