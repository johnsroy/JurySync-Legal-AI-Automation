import Stripe from 'stripe';
import { Request, Response } from 'express';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing Stripe secret key');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-01-27',
});

type ProductConfig = {
  price: number;
  name: string;
  interval: 'month' | 'year';
};

type Products = {
  [key: string]: ProductConfig;
};

const PRODUCTS: Products = {
  'student-monthly': {
    price: 2400, // $24.00
    name: 'Student Monthly',
    interval: 'month'
  },
  'student-yearly': {
    price: 24000, // $240.00
    name: 'Student Yearly',
    interval: 'year'
  },
  'professional-monthly': {
    price: 19400, // $194.00
    name: 'Professional Monthly',
    interval: 'month'
  },
  'professional-yearly': {
    price: 188800, // $1,888.00
    name: 'Professional Yearly',
    interval: 'year'
  }
};

export async function createCheckoutSession(req: Request, res: Response) {
  try {
    const { planType } = req.body;

    if (!planType || !PRODUCTS[planType]) {
      return res.status(400).json({ error: 'Invalid plan type' });
    }

    const product = PRODUCTS[planType];

    // Create Stripe session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: product.name,
            },
            unit_amount: product.price,
            recurring: {
              interval: product.interval,
            },
          },
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${req.headers.origin}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.origin}/pricing`,
    });

    res.json({ sessionId: session.id });
  } catch (err) {
    console.error('Error creating checkout session:', err);
    res.status(500).json({ error: 'Error creating checkout session' });
  }
}

export async function createPortalSession(req: Request, res: Response) {
  try {
    const { customerId } = req.body;

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${req.headers.origin}/dashboard`,
    });

    res.json({ url: portalSession.url });
  } catch (err) {
    console.error('Error creating portal session:', err);
    res.status(500).json({ error: 'Error creating portal session' });
  }
}