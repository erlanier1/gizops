import Stripe from 'stripe';

let stripe;

export function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    throw new Error('Missing STRIPE_SECRET_KEY environment variable.');
  }

  if (!stripe) {
    stripe = new Stripe(secretKey);
  }

  return stripe;
}

export function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
}

