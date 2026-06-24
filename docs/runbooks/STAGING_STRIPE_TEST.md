# Staging Stripe test — confirm the two Stripe secrets end-to-end

Goal: prove the staging `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are the
right values by running one **test-card** purchase. No real money moves.

Staging app: <https://apex-staging-2ft.pages.dev> · staging Supabase
`bieqfzwljxkmmldmlzyb`. Both Stripe secrets are already *present* (digest-confirmed
2026-06-21); this confirms they actually *work*.

## Prerequisite (one-time): Stripe test-mode webhook endpoint
For fulfilment to happen, your Stripe **test mode** dashboard needs a webhook
endpoint pointing at the staging function:
- URL: `https://bieqfzwljxkmmldmlzyb.functions.supabase.co/stripe-webhook`
- Events: at least `checkout.session.completed`
- Its **Signing secret** (`whsec_…`) must equal the staging `STRIPE_WEBHOOK_SECRET`.
  (If you're unsure it matches, copy it from Stripe and re-set:
  `supabase secrets set STRIPE_WEBHOOK_SECRET="whsec_…" --project-ref bieqfzwljxkmmldmlzyb`.)

## Steps
1. **Create a ticket** — log into the staging app as the super-admin → the event
   **"STAGING — Demo League"** → its ticketing/booking setup → add a **spectator
   ticket type** (e.g. "General — 50 AED"). Save. (Staging currently has zero
   `ticket_types`, which is why this step is needed.)
2. **Buy it** — open the public tickets page: `/tickets/staging-demo-league` →
   add the ticket → checkout.
3. **Pay with a Stripe test card** on the Stripe-hosted page:
   `4242 4242 4242 4242`, any future expiry, any CVC, any postal code → pay.

## What "good" looks like
- **Reaching the Stripe-hosted checkout page** (step 3) ⇒ `STRIPE_SECRET_KEY` is
  valid (the session was created server-side). ✅ **(this is check (a))**
- **After paying, the order flips to paid** ⇒ `STRIPE_WEBHOOK_SECRET` + the
  endpoint are correct. ✅ **(this confirms the webhook secret's value)**
  Confirm either way:
  - Admin UI: the spectator order shows **paid / ticket issued**, OR
  - Stripe dashboard → the webhook delivery shows **200**, OR
  - REST check (anon key):
    ```bash
    curl -s "https://bieqfzwljxkmmldmlzyb.supabase.co/rest/v1/spectator_orders?select=qr_code_id,payment_status,fulfillment_status&order=created_at.desc&limit=3" \
      -H "apikey: <staging anon>" -H "Authorization: Bearer <staging anon>"
    ```
    Expect the newest row `payment_status:"paid"`, `fulfillment_status:"completed"`.

## If it fails
- **Stuck before Stripe page / "Invalid payment type"/pricing error:** check the
  ticket type saved and the event slug; `create-payment-session` re-prices
  server-side from `ticket_types` (client price is never trusted).
- **Paid but order not updated:** the webhook secret or endpoint is wrong — check
  the Stripe delivery log (4xx = signature mismatch ⇒ re-set
  `STRIPE_WEBHOOK_SECRET`). The function returns 400 on mismatch so Stripe retries.

When both checks are green, the staging Stripe path is fully verified; the live
equivalents get confirmed during the Group-B live deploy
([`LIVE_EDGE_DEPLOY.md`](LIVE_EDGE_DEPLOY.md)).
