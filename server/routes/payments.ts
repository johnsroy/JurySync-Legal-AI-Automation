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
    console.log('Creating checkout session...');
    const { planId, interval = 'month' } = req.body;

    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Get the plan details
    const plan = await db.select().from(subscriptionPlans)
      .where(eq(subscriptionPlans.id, planId))
      .limit(1);

    if (!plan || plan.length === 0) {
      return res.status(400).json({ error: 'Invalid plan selected' });
    }

    const selectedPlan = plan[0];
    const priceId = interval === 'year' ? selectedPlan.stripePriceIdYearly : selectedPlan.stripePriceIdMonthly;

    // Create checkout session
    const session = await stripeService.createCheckoutSession({
      email: req.user.email,
      priceId,
      userId: req.user.id,
      planId: selectedPlan.id,
      isTrial: selectedPlan.isStudent,
      successUrl: `${process.env.APP_URL}/subscription?success=true`,
      cancelUrl: `${process.env.APP_URL}/subscription?canceled=true`
    });

    console.log('Checkout session created:', session.id);
    res.json({ url: session.url });
  } catch (error) {
    console.error('Stripe error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to create checkout session' 
    });
  }
});

// Webhook handling
router.post('/webhook', async (req, res) => {
  try {
    const rawBody = await getRawBody(req);
    const sig = req.headers['stripe-signature'];

    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      console.error('Webhook secret not configured');
      return res.status(500).send('Webhook secret not configured');
    }

    const event = stripe.webhooks.constructEvent(
      rawBody,
      sig!,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object;
        // Create subscription record
        await db.insert(subscriptions).values({
          userId: parseInt(session.metadata.userId),
          planId: parseInt(session.metadata.planId),
          stripeCustomerId: session.customer as string,
          stripeSubscriptionId: session.subscription as string,
          status: 'active',
          currentPeriodStart: new Date(session.created * 1000),
          currentPeriodEnd: new Date(session.expires_at * 1000),
        });
        console.log('Subscription created:', session);
        break;

      case 'customer.subscription.updated':
        const subscription = event.data.object;
        await db.update(subscriptions)
          .set({
            status: subscription.status,
            currentPeriodStart: new Date(subscription.current_period_start * 1000),
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          })
          .where(eq(subscriptions.stripeSubscriptionId, subscription.id));
        break;

      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Webhook Error:', err);
    return res.status(400).send(
      `Webhook Error: ${err instanceof Error ? err.message : 'Unknown error'}`
    );
  }
});

export default router;