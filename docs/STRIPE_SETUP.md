# Stripe billing (StackPilot)

## Environment variables (Vercel + local)

| Variable | Required | Purpose |
|----------|----------|---------|
| `STRIPE_SECRET_KEY` | Yes | Server API (`sk_live_...` or `sk_test_...`) |
| `STRIPE_PRICE_PRO` | Yes | **Recurring** Price ID for Pro (`price_...`) — not the Product ID |
| `STRIPE_WEBHOOK_SECRET` | Yes in prod | Webhook signing secret (`whsec_...`) |
| `NEXTAUTH_URL` | Yes | Public site URL (used for Checkout / Portal return URLs) |

After setting variables, redeploy. Call **`/api/setup-db` once** (or run migrations) so `user_subscriptions.stripe_customer_id` exists on older databases.

## Stripe Dashboard

1. **Product** → add *StackPilot Pro* (or reuse an existing product).
2. **Price** → recurring (monthly or yearly) → copy the **Price ID** into `STRIPE_PRICE_PRO`.
3. **Developers** → **Webhooks** → add endpoint: `https://<your-domain>/api/stripe/webhook`  
   - Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`  
   - Copy the **signing secret** into `STRIPE_WEBHOOK_SECRET`.
4. **Settings** → **Customer portal** → enable so “Manage billing” works.

## Local testing

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Use the CLI’s `whsec_...` as `STRIPE_WEBHOOK_SECRET` in `.env.local` while testing.

## App behavior

- **Settings → Upgrade with Stripe** (trial only): Checkout Session, metadata `userId` on the subscription.
- **Settings → Manage billing** (Pro + customer on file): Stripe Customer Portal.
- Webhooks sync `user_subscriptions`: `plan` (`pro` / `trial`), `stripe_customer_id`, `external_subscription_id`, periods, amounts.

Listing limits: **`trial`** uses `TRIAL_LIST_LIMIT`; **`pro`** bypasses the trial cap (same as before once `plan !== 'trial'` in the DB).
