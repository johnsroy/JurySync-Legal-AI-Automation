import { Request, Response } from 'express';
import { stripe } from '../services/stripe';
import { db } from '../db';
import { subscriptions } from '@shared/schema/subscriptions';

export const handleStripeWebhook = async (req: Request, res: Response) => {
  try {
    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      console.error('Webhook secret not configured');
      return res.status(500).json({ error: 'Webhook secret not configured' });
    }

    const sig = req.headers['stripe-signature'];
    if (!sig) {
      console.error('No Stripe signature found in headers');
      return res.status(400).json({ error: 'No Stripe signature found' });
    }

    console.log('Processing webhook with signature:', sig);
    console.log('Raw body:', req.body.toString());

    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
      console.log('Successfully constructed Stripe event:', event.type);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return res.status(400).json({ error: 'Webhook signature verification failed' });
    }

    // Handle the event
    console.log('Processing event type:', event.type);
    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object;
        console.log('Processing checkout.session.completed:', {
          customer: session.customer,
          subscription: session.subscription,
          metadata: session.metadata
        });

        const userId = session.metadata?.userId;
        const planId = session.metadata?.planId;

        if (!userId || !planId) {
          console.error('Missing required metadata:', { userId, planId });
          return res.status(400).json({ error: 'Missing required metadata' });
        }

        await db.insert(subscriptions).values({
          stripeCustomerId: session.customer as string,
          stripeSubscriptionId: session.subscription as string,
          planId: parseInt(planId),
          userId: parseInt(userId),
          status: 'active',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1 day trial
          cancelAtPeriodEnd: false
        });
        console.log('Successfully created subscription record');
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    console.log('Successfully processed webhook');
    return res.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(400).json({
      error: error instanceof Error ? error.message : 'Webhook processing failed'
    });
  }
};