import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@11.1.0?target=deno'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2022-11-15',
  httpClient: Stripe.createFetchHttpClient(),
})

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

const RESPONSE_HEADERS = { 'Content-Type': 'application/json' };

serve(async (req: Request) => {
  try {
    const signature = req.headers.get('stripe-signature')

    if (!signature) {
      return new Response(JSON.stringify({ error: 'Missing signature' }), { status: 400, headers: RESPONSE_HEADERS })
    }

    // 🕵️ Debug: Log first 7 chars of secret to check Live vs Test
    console.log(`🔍 [Debug] Secret Prefix: ${webhookSecret?.substring(0, 10)}... [Signature: ${signature.substring(0, 10)}...]`);

    // ✅ THE DEFINITIVE FIX: Use clone() + arrayBuffer() for Supabase Edge
    const rawBody = new Uint8Array(await req.clone().arrayBuffer());

    const event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature!,
      webhookSecret
    )

    console.log(`✅ [Verified] Event: ${event.type} [ID: ${event.id}] [Livemode: ${event.livemode}]`);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session
      
      if (session.payment_status === 'paid') {
        const { type, orderId, token: metaToken, accreditationId, eventId, customerEmail } = session.metadata || {}
        const token = metaToken || accreditationId;

        // 🎟️ FLOW 1: SPECTATORS
        if (type === 'spectator' && orderId) {
          const { data: existing } = await supabase.from('spectator_orders').select('id').eq('stripe_event_id', event.id).maybeSingle();
          if (!existing) {
            await supabase.from('spectator_orders').update({ 
              payment_status: 'paid',
              fulfillment_status: 'completed',
              stripe_session_id: session.id,
              stripe_event_id: event.id 
            }).eq('qr_code_id', orderId);
             console.log(`🎫 Ticket Generated for Order: ${orderId}`);
          }
        }

        // 🏅 FLOW 2: ATHLETES (Payment-Link Accreditation)
        else if (type === 'accreditation') {
          const { accreditationRecordId, inviteLinkId, eventId } = session.metadata || {}

          if (!accreditationRecordId) {
            console.error(`🔴 [Webhook] Missing accreditationRecordId for event ${event.id}`);
            return new Response(JSON.stringify({ received: true }), { status: 200, headers: RESPONSE_HEADERS });
          }

          // Check for existing processing to ensure idempotency
          const { data: existing } = await supabase.from('accreditations').select('id').eq('stripe_event_id', event.id).maybeSingle();
          if (existing) {
            console.log(`ℹ️ [Webhook] Accreditation ${accreditationRecordId} already processed for event ${event.id}`);
            return new Response(JSON.stringify({ received: true }), { status: 200, headers: RESPONSE_HEADERS });
          }

          const { data: updated, error: updateError } = await supabase
            .from('accreditations')
            .update({
              status: 'approved',
              payment_status: 'paid',
              stripe_session_id: session.id,
              stripe_event_id: event.id
            })
            .eq('id', accreditationRecordId)
            .select()
            .maybeSingle();

          if (updateError) {
            console.error(`🔴 [Webhook] Failed to approve accreditation ${accreditationRecordId}:`, updateError);
          } else if (!updated) {
            console.error(`🔴 [Webhook] Record ${accreditationRecordId} not found in DB`);
          } else {
            console.log(`🎖️ Athlete Approved (Webhook): ${accreditationRecordId}`);
            
            // 📈 [APX-S6] Increment Invite Link usage if applicable
            if (inviteLinkId && eventId) {
              try {
                const settingsKey = `event_${eventId}_invite_links`;
                const { data: settingsData } = await supabase
                  .from('global_settings')
                  .select('value')
                  .eq('key', settingsKey)
                  .single();

                if (settingsData?.value) {
                  const links = typeof settingsData.value === 'string' ? JSON.parse(settingsData.value) : settingsData.value;
                  const updatedLinks = links.map((l: any) => {
                    if (l.id !== inviteLinkId) return l;
                    const newCount = (l.useCount || 0) + 1;
                    const shouldDeactivate = l.mode === 'single' || (l.maxUses !== null && newCount >= l.maxUses);
                    return { ...l, useCount: newCount, isActive: shouldDeactivate ? false : l.isActive };
                  });
                  
                  await supabase
                    .from('global_settings')
                    .update({ value: JSON.stringify(updatedLinks) })
                    .eq('key', settingsKey);
                    
                  console.log(`📈 Increment useCount for link: ${inviteLinkId}`);
                }
              } catch (linkErr) {
                console.error(`⚠️ [Webhook] Failed to increment invite link count:`, linkErr);
              }
            }
          }
        }
      }
    }

    return new Response(JSON.stringify({ received: true }), { status: 200, headers: RESPONSE_HEADERS })

  } catch (err: any) {
    console.error(`⚠️ [Error] Webhook Verification Failed: ${err.message}`)
    // Return 200 to prevent Stripe from retrying an already failing signature
    return new Response(JSON.stringify({ received: true, note: err.message }), { status: 200, headers: RESPONSE_HEADERS })
  }
})
