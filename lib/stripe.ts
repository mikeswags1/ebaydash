import Stripe from 'stripe'

let stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (!stripe) {
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) throw new Error('STRIPE_SECRET_KEY is not configured')
    stripe = new Stripe(key)
  }
  return stripe
}

export function getStripeProPriceId(): string {
  return (
    process.env.STRIPE_PRICE_PRO?.trim() ||
    process.env.STRIPE_PRO_PRICE_ID?.trim() ||
    process.env.STRIPE_PRICE_ID?.trim() ||
    ''
  )
}

/** Checkout + portal routes need both a secret key and the Pro recurring Price ID. */
export function isStripeBillingConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim() && getStripeProPriceId())
}
