import { Router } from 'express';
import { stripe, stripeService } from '../services/stripe';
import getRawBody from 'raw-body';
import { db } from '../db';
import { subscriptions, subscriptionPlans } from '@shared/schema/subscriptions';
import { eq } from 'drizzle-orm';

const router = Router();

// Create checkout session
router.post('/create-checkout-session', async (req, res) => {
  try {
    const { planId, interval = 'month' } = req.body;

    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Get the plan details
    const plan = await db.select().from(subscriptionPlans)
      .where(eq(subscriptionPlans.id, planId))
      .limit(1);

    if (!plan || plan.length === 0) {
      return res.status(400).json({ error: 'Invalid subscription plan' });
    }

    const selectedPlan = plan[0];
    const priceId = interval === 'year' ? selectedPlan.stripePriceIdYearly : selectedPlan.stripePriceIdMonthly;

    if (!priceId) {
      return res.status(400).json({ error: 'Invalid price configuration' });
    }

    // Create checkout session with Link payment
    const result = await stripeService.createCheckoutSession({
      email: req.user.email,
      priceId,
      userId: req.user.id,
      planId: selectedPlan.id,
      successUrl: `${process.env.APP_URL}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${process.env.APP_URL}/subscription?canceled=true`
    });

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    // Return the URL for the client to redirect to
    res.json({ url: result.session.url });
  } catch (error) {
    console.error('Stripe error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to create checkout session' 
    });
  }
});

// Get current subscription
router.get('/current-subscription', async (req, res) => {
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

    // Get plan details
    const plan = await db.select().from(subscriptionPlans)
      .where(eq(subscriptionPlans.id, subscription[0].planId))
      .limit(1);

    // Get Stripe subscription details
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

// Cancel subscription
router.post('/cancel-subscription', async (req, res) => {
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

// Webhook handling
router.post('/webhook', async (req, res) => {
  try {
    const rawBody = await getRawBody(req);
    const sig = req.headers['stripe-signature'];

    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      console.error('Webhook secret not configured');
      return res.status(500).json({ error: 'Webhook secret not configured' });
    }

    if (!sig) {
      return res.status(400).json({ error: 'No signature header' });
    }

    const event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;

        if (!session.metadata?.userId || !session.metadata?.planId) {
          throw new Error('Missing metadata in session');
        }

        // Create subscription record
        await db.insert(subscriptions).values({
          userId: parseInt(session.metadata.userId),
          planId: parseInt(session.metadata.planId),
          stripeCustomerId: session.customer as string,
          stripeSubscriptionId: session.subscription as string,
          status: 'active',
          currentPeriodStart: new Date(session.created * 1000),
          currentPeriodEnd: new Date((session.created + 86400) * 1000), // 1 day trial
          cancelAtPeriodEnd: false,
        });

        console.log('Subscription created:', session.id);
        break;
      }

      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Webhook Error:', err);
    return res.status(400).json({
      error: err instanceof Error ? err.message : 'Unknown error'
    });
  }
});

export default router;