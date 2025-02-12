import { Router } from 'express';
import { paymentsAgent } from '../agents/paymentsAgent';
import { db } from '../db';
import { eq } from 'drizzle-orm';
import { subscriptions, subscriptionPlans } from '@shared/schema/subscriptions';
import { stripe } from '../services/stripe';
import getRawBody from 'raw-body';

const router = Router();

// Middleware to ensure user is authenticated
const requireAuth = (req: any, res: any, next: any) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// Webhook handling route - must be before express.json() middleware
router.post('/webhook', async (req, res) => {
  if (req.headers['content-type'] !== 'application/json') {
    return res.status(400).send('Invalid content type');
  }

  let event;

  try {
    const rawBody = await getRawBody(req);
    const sig = req.headers['stripe-signature'];

    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      console.error('Webhook secret not configured');
      return res.status(500).send('Webhook secret not configured');
    }

    try {
      event = stripe.webhooks.constructEvent(
        rawBody,
        sig!,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err: any) {
      console.error(`⚠️ Webhook signature verification failed:`, err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    console.log('Received Stripe webhook event:', event.type);

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        // Update subscription status in database
        const { metadata } = session;
        if (metadata?.userId && metadata?.planId) {
          await db.insert(subscriptions).values({
            userId: parseInt(metadata.userId),
            planId: parseInt(metadata.planId),
            stripeCustomerId: session.customer as string,
            stripeSubscriptionId: session.subscription as string,
            status: 'active',
            currentPeriodStart: new Date(session.created * 1000),
            currentPeriodEnd: new Date((session.created + 30 * 24 * 60 * 60) * 1000), // 30 days from creation
            cancelAtPeriodEnd: false,
          });
        }
        break;
      }
      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        // Update subscription details
        await db
          .update(subscriptions)
          .set({
            status: subscription.status,
            currentPeriodStart: new Date(subscription.current_period_start * 1000),
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
          })
          .where(eq(subscriptions.stripeSubscriptionId, subscription.id));
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        // Update subscription status to canceled
        await db
          .update(subscriptions)
          .set({
            status: 'canceled',
            cancelAtPeriodEnd: true,
          })
          .where(eq(subscriptions.stripeSubscriptionId, subscription.id));
        break;
      }
      default: {
        console.log(`Unhandled event type: ${event.type}`);
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
});

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

// Create Checkout Session
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
    const subscription = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, req.user!.id))
      .limit(1);

    if (!subscription || subscription.length === 0) {
      return res.json(null);
    }

    // Get plan details
    const plan = await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.id, subscription[0].planId))
      .limit(1);

    res.json({
      ...subscription[0],
      plan: plan[0],
    });
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