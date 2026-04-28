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
    const { sessionId, orderId } = await req.json()
    console.log(`Verification request - Session: ${sessionId}, Order: ${orderId}`);
    
    let session: any = null;

    if (sessionId) {
      session = await stripe.checkout.sessions.retrieve(sessionId)
    } else if (orderId) {
      // APX-101: Advanced autonomous recovery via Search API
      console.log(`Searching Stripe for orderId: ${orderId}`);
      
      try {
        // Precise search is much more reliable than listing if we have the orderId
        const search = await (stripe as any).checkout.sessions.search({
          query: `metadata['orderId']:'${orderId}'`,
        });
        if (search.data.length > 0) {
          session = search.data[0];
        } else {
          // Fallback to listing if search (which is slightly delayed) yields nothing
          const sessions = await stripe.checkout.sessions.list({ limit: 20 });
          session = sessions.data.find((s: any) => s.metadata?.orderId === orderId);
        }
      } catch (e: any) {
        console.warn("Stripe Search fallback error:", e.message);
        // Pure listing fallback
        const sessions = await stripe.checkout.sessions.list({ limit: 20 });
        session = sessions.data.find((s: any) => s.metadata?.orderId === orderId);
      }
    }

    if (!session) throw new Error("No matching Stripe session found");
    
    console.log(`Session found: ${session.id}, status: ${session.payment_status}`);
    const isPaid = session.payment_status === 'paid'
    
    if (isPaid) {
      const dbOrderId = session.metadata?.orderId
      if (dbOrderId) {
        console.log(`Atomic update for order: ${dbOrderId}`);
        await supabase
          .from('spectator_orders')
          .update({ payment_status: 'paid', stripe_session_id: session.id })
          .eq('qr_code_id', dbOrderId)
      }

      // [APX-S6] READ-ONLY VALIDATION: Webhook is now the sole authority for creation/fulfillment
      // No longer inserting records here. Reporting status to frontend for UI feedback.
      if (session.metadata?.type === 'accreditation') {
        const recordId = session.metadata?.accreditationRecordId;
        if (recordId && isPaid) {
          console.log(`Reporting payment success for accreditation: ${recordId}`);
        }
      }
    }

    let accreditation: any = null;
    if (session.metadata?.type === 'accreditation') {
      const recordId = session.metadata?.accreditationRecordId;
      if (recordId) {
        const { data } = await supabase
          .from('accreditations')
          .select('id, status, payment_status')
          .eq('id', recordId)
          .maybeSingle();
        accreditation = data;
      }
    }

    return new Response(JSON.stringify({ 
      success: isPaid,
      status: session.payment_status,
      accreditation,
      session: {
        id: session.id,
        payment_status: session.payment_status,
        metadata: session.metadata
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error(`Error verifying session: ${error.message}`);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
