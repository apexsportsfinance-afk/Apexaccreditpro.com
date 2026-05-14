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

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { type, eventId, eventSlug, items, customerEmail, customerName, metadata, formData, inviteLinkId } = await req.json()
    
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

    // [APX-S6] DEPRECATED: Staging logic for accreditations is removed.
    // Records are now pre-created in the 'accreditations' table before Stripe redirection.

    if (type === 'accreditation') {
      lineItems = [{
        price_data: {
          currency: 'aed',
          product_data: {
            name: `Accreditation Fee - ${eventSlug}`,
            description: `Registration fee for ${customerName}`,
          },
          unit_amount: Math.round(metadata.amount * 100),
        },
        quantity: 1,
      }]
    } else if (type === 'spectator') {
      lineItems = items.map((item: any) => ({
        price_data: {
          currency: 'aed',
          product_data: {
            name: item.name,
            description: item.description,
          },
          unit_amount: Math.round(item.price * 100),
        },
        quantity: item.quantity,
      }))
    }

    // Determine redirect base
    const origin = req.headers.get('origin') || 'http://localhost:5173'
    let redirectPath = `/${type === 'accreditation' ? 'register' : 'tickets'}/${eventSlug}`
    if (type === 'accreditation' && metadata.token) {
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
