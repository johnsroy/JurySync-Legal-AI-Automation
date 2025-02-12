import { Router } from 'express';
import { stripe, stripeService } from '../services/stripe';
import { db } from '../db';
import { subscriptionPlans, subscriptions } from '@shared/schema/subscriptions';
import { eq } from 'drizzle-orm';
import { paymentsAgent } from '../agents/paymentsAgent';
import { type Request, Response } from 'express';

const router = Router();

// Webhook test endpoint
router.post('/webhook-test', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');

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

// Regular routes - these will use JSON parsing middleware
router.post('/create-checkout-session', async (req: Request, res: Response) => {
  try {
    const { planId } = req.body;

    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!planId) {
      return res.status(400).json({ error: 'Plan ID is required' });
    }

    const plan = await db.select().from(subscriptionPlans)
      .where(eq(subscriptionPlans.id, planId))
      .limit(1);

    if (!plan || plan.length === 0) {
      return res.status(400).json({ error: 'Invalid subscription plan' });
    }

    const selectedPlan = plan[0];
    const priceId = selectedPlan.stripePriceIdMonthly;

    if (!priceId) {
      return res.status(400).json({ error: 'Invalid price configuration' });
    }

    const result = await stripeService.createCheckoutSession({
      email: req.user.email,
      priceId,
      userId: req.user.id,
      planId: selectedPlan.id,
      successUrl: `${process.env.APP_URL}/subscription?success=true`,
      cancelUrl: `${process.env.APP_URL}/subscription?canceled=true`
    });

    if (!result.success || !result.url) {
      return res.status(400).json({ error: result.error || 'Failed to create checkout session' });
    }

    return res.json({ url: result.url });
  } catch (error) {
    console.error('Checkout error:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to create checkout session' 
    });
  }
});

router.get('/current-subscription', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const subscription = await db.select().from(subscriptions)
      .where(eq(subscriptions.userId, req.user.id))
      .limit(1);

    if (!subscription || subscription.length === 0) {
      return res.json(null);
    }

    const plan = await db.select().from(subscriptionPlans)
      .where(eq(subscriptionPlans.id, subscription[0].planId))
      .limit(1);

    const stripeSubscription = await stripe.subscriptions.retrieve(
      subscription[0].stripeSubscriptionId
    );

    res.json({
      ...subscription[0],
      plan: plan[0],
      stripeSubscription
    });
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