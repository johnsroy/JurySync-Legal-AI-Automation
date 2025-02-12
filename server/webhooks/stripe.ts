import { Request, Response } from 'express';
import { stripe } from '../services/stripe';
import { db } from '../db';
import { subscriptions, subscriptionPlans } from '@shared/schema/subscriptions';
import { eq } from 'drizzle-orm';

export const handleStripeWebhook = async (req: Request, res: Response) => {
  try {
    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      return res.status(500).json({ error: 'Webhook secret not configured' });
    }

    const sig = req.headers['stripe-signature'];
    if (!sig) {
      return res.status(400).json({ error: 'No Stripe signature found' });
    }

    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return res.status(400).json({ error: 'Webhook signature verification failed' });
    }

    console.log('Received Stripe webhook event:', event.type);

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object;

        console.log('Payment completed:', {
          customerId: session.customer,
          metadata: session.metadata
        });

        // Acknowledge the webhook
        return res.json({ received: true });

      default:
        console.log(`Unhandled event type ${event.type}`);
        return res.json({ received: true });
    }
  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(400).json({
      error: error instanceof Error ? error.message : 'Webhook processing failed'
    });
  }
};