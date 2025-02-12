import { Router } from 'express';
import { stripe } from '../services/stripe';
import { db } from '../db';
import { subscriptionPlans, subscriptions } from '@shared/schema/subscriptions';
import { eq } from 'drizzle-orm';
import { paymentsAgent } from '../agents/paymentsAgent';
import { type Request, Response } from 'express';
import { handleStripeWebhook } from '../webhooks/stripe';
import * as express from 'express';

const router = Router();

// Configure webhook endpoint with raw body parsing
router.post('/webhook', express.raw({ type: 'application/json' }), handleStripeWebhook);

// Webhook test endpoint
router.post('/webhook-test', async (req: Request, res: Response) => {
  try {
    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      return res.status(500).json({ error: 'Webhook secret not configured' });
    }

    console.log('Headers:', req.headers);
    console.log('Body:', req.body);

    return res.status(200).json({ 
      status: 'success',
      message: 'Webhook endpoint is accessible',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Webhook test error:', error);
    return res.status(500).json({ error: 'Webhook test failed' });
  }
});

// Create payment link for subscription
router.post('/create-payment-link', async (req: Request, res: Response) => {
  try {
    const { planId } = req.body;

    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!planId) {
      return res.status(400).json({ error: 'Plan ID is required' });
    }

    const result = await paymentsAgent.initializePaymentLink(req.user, planId);

    if (!result.success || !result.url) {
      return res.status(400).json({ error: result.error || 'Failed to create payment link' });
    }

    return res.json({ url: result.url });
  } catch (error) {
    console.error('Payment link creation error:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to create payment link' 
    });
  }
});

router.get('/current-subscription', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const result = await paymentsAgent.getSubscriptionStatus(req.user);

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json(result.subscription);
  } catch (error) {
    console.error('Error fetching subscription:', error);
    res.status(500).json({ error: 'Failed to fetch subscription details' });
  }
});

router.post('/cancel-subscription', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const result = await paymentsAgent.cancelSubscription(req.user);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ message: 'Subscription cancelled successfully' });
  } catch (error) {
    console.error('Error cancelling subscription:', error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

export default router;