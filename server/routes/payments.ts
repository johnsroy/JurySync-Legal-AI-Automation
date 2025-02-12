import { Router } from 'express';
import { paymentsAgent } from '../agents/paymentsAgent';
import { db } from '../db';
import { eq } from 'drizzle-orm';
import { subscriptions, subscriptionPlans } from '@shared/schema/subscriptions';

const router = Router();

// Middleware to ensure user is authenticated
const requireAuth = (req: any, res: any, next: any) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// Get subscription plans
router.get('/plans', async (req, res) => {
  try {
    const plans = await db.select().from(subscriptionPlans);
    res.json(plans);
  } catch (error) {
    console.error('Error fetching plans:', error);
    res.status(500).json({ error: 'Failed to fetch plans' });
  }
});

// Create checkout session
router.post('/create-checkout-session', requireAuth, async (req, res) => {
  try {
    const { planId, interval } = req.body;
    console.log('Creating checkout session:', { planId, interval, userId: req.user?.id });

    const result = await paymentsAgent.initializeCheckout(
      req.user!,
      planId,
      interval
    );

    if (!result.success) {
      console.error('Failed to create checkout session:', result.error);
      return res.status(400).json({ error: result.error });
    }

    res.json({ sessionId: result.sessionId });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// Get current subscription
router.get('/current-subscription', requireAuth, async (req, res) => {
  try {
    const result = await paymentsAgent.getSubscriptionStatus(req.user!);

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json(result.subscription);
  } catch (error) {
    console.error('Error fetching subscription:', error);
    res.status(500).json({ error: 'Failed to fetch subscription' });
  }
});

// Cancel subscription
router.post('/cancel-subscription', requireAuth, async (req, res) => {
  try {
    const result = await paymentsAgent.cancelSubscription(req.user!);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error canceling subscription:', error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

export default router;