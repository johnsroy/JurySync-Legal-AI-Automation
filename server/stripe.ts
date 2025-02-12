import Stripe from 'stripe';
import { Request, Response } from 'express';
import { PRICING_PLANS, type Plan } from '@shared/schema/pricing';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing Stripe secret key');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

// Convert our pricing plans to Stripe format
const PRODUCTS = PRICING_PLANS.reduce((acc, plan) => {
  if (plan.tier === 'enterprise') return acc; // Skip enterprise as it's custom priced

  acc[plan.id] = {
    price: plan.price * 100, // Convert to cents
    name: plan.name,
    interval: plan.interval,
  };
  return acc;
}, {} as Record<string, {
  price: number;
  name: string;
  interval: 'month' | 'year';
}>);

export async function createCheckoutSession(req: Request, res: Response) {
  try {
    const { planType } = req.body;

    if (!planType || !PRODUCTS[planType]) {
      return res.status(400).json({ error: 'Invalid plan type' });
    }

    const product = PRODUCTS[planType];

    // Create Stripe session with trial period
    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: product.name,
              description: `JurySync.io ${product.name} Subscription`,
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
      success_url: `${req.headers.origin}/dashboard?session_id={CHECKOUT_SESSION_ID}&success=true`,
      cancel_url: `${req.headers.origin}/pricing?canceled=true`,
      customer_creation: 'always',
      payment_method_types: ['card', 'us_bank_account'],
      billing_address_collection: 'required',
      allow_promotion_codes: true,
      automatic_tax: { enabled: true },
      tax_id_collection: { enabled: true },
      metadata: {
        planType,
      },
    });

    res.json({ sessionId: session.id });
  } catch (err: any) {
    console.error('Error creating checkout session:', err);
    res.status(500).json({ error: 'Error creating checkout session', details: err.message });
  }
}

export async function createPortalSession(req: Request, res: Response) {
  try {
    const { customerId } = req.body;

    if (!customerId) {
      return res.status(400).json({ error: 'Customer ID is required' });
    }

    // Create a billing portal session
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${req.headers.origin}/dashboard`,
      configuration: {
        features: {
          payment_method_update: { enabled: true },
          customer_update: { 
            enabled: true,
            allowed_updates: ['email', 'address', 'phone'],
          },
          invoice_history: { enabled: true },
          subscription_cancel: { enabled: true },
          subscription_pause: { enabled: true },
        },
      },
    });

    res.json({ url: portalSession.url });
  } catch (err: any) {
    console.error('Error creating portal session:', err);
    res.status(500).json({ error: 'Error creating portal session', details: err.message });
  }
}

// Handle Stripe webhooks
export async function handleWebhook(req: Request, res: Response) {
  const sig = req.headers['stripe-signature'];

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    throw new Error('Missing Stripe webhook secret');
  }

  try {
    const event = stripe.webhooks.constructEvent(
      req.body,
      sig as string,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    // Handle specific webhook events
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        const subscription = event.data.object as Stripe.Subscription;
        // Update user's subscription status in your database
        await handleSubscriptionChange(subscription);
        break;

      case 'invoice.paid':
        const invoice = event.data.object as Stripe.Invoice;
        // Handle successful payment
        await handleSuccessfulPayment(invoice);
        break;

      case 'invoice.payment_failed':
        // Handle failed payment
        await handleFailedPayment(event.data.object as Stripe.Invoice);
        break;
    }

    res.json({ received: true });
  } catch (err: any) {
    console.error('Webhook error:', err);
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
}

async function handleSubscriptionChange(subscription: Stripe.Subscription) {
  // TODO: Implement subscription status update in database
  console.log('Subscription changed:', subscription.id, subscription.status);
}

async function handleSuccessfulPayment(invoice: Stripe.Invoice) {
  // TODO: Implement successful payment handling
  console.log('Payment succeeded:', invoice.id);
}

async function handleFailedPayment(invoice: Stripe.Invoice) {
  // TODO: Implement failed payment handling
  console.log('Payment failed:', invoice.id);
}