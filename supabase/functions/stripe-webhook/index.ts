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

serve(async (req) => {
  const signature = req.headers.get('stripe-signature')
  
  try {
    const body = await req.text()
    const event = stripe.webhooks.constructEvent(
      body,
      signature!,
      Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? ''
    )

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session
      const { type, accreditationId, orderId } = session.metadata || {}

      console.log(`Processing checkout.session.completed for type: ${type}, session: ${session.id}`);

      if (type === 'accreditation') {
        console.log(`Updating accreditation ${accreditationId} to paid`);
        const { error } = await supabase
          .from('accreditations')
          .update({ 
            payment_status: 'paid', 
            stripe_session_id: session.id,
            payment_amount: (session.amount_total ?? 0) / 100 
          })
          .eq('id', accreditationId)
        
        if (error) {
          console.error(`Error updating accreditation: ${error.message}`);
          throw error
        }
      } else if (type === 'spectator') {
        console.log(`Updating spectator_order ${orderId} to paid`);
        const { error } = await supabase
          .from('spectator_orders')
          .update({ 
            payment_status: 'paid', 
            stripe_session_id: session.id 
          })
          .eq('qr_code_id', orderId)
        
        if (error) {
          console.error(`Error updating spectator_order: ${error.message}`);
          throw error
        }
      } else {
        console.warn(`Unknown session type: ${type}`);
      }
    }

    return new Response(JSON.stringify({ received: true }), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (err) {
    console.error(`Webhook Error: ${err.message}`);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 })
  }
})
