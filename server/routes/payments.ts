import { Router } from 'express';
import { stripe, stripeService } from '../services/stripe';
import { db } from '../db';
import { subscriptionPlans, subscriptions } from '@shared/schema/subscriptions';
import { eq } from 'drizzle-orm';
import getRawBody from 'raw-body';
import * as express from 'express';

const router = Router();

// Create checkout session
router.post('/create-checkout-session', async (req, res) => {
  try {
    console.log('Received create-checkout-session request:', req.body);
    const { planId } = req.body;

    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!planId) {
      return res.status(400).json({ error: 'Plan ID is required' });
    }

    // Get the plan details
    const plan = await db.select().from(subscriptionPlans)
      .where(eq(subscriptionPlans.id, planId))
      .limit(1);

    if (!plan || plan.length === 0) {
      return res.status(400).json({ error: 'Invalid subscription plan' });
    }

    const selectedPlan = plan[0];
    console.log('Selected plan:', selectedPlan);
    const priceId = selectedPlan.stripePriceIdMonthly;

    if (!priceId) {
      return res.status(400).json({ error: 'Invalid price configuration' });
    }

    // Create checkout session
    const result = await stripeService.createCheckoutSession({
      email: req.user.email,
      priceId,
      userId: req.user.id,
      planId: selectedPlan.id,
      successUrl: `${process.env.APP_URL}/subscription?success=true`,
      cancelUrl: `${process.env.APP_URL}/subscription?canceled=true`
    });

    if (!result.success) {
      console.error('Failed to create checkout session:', result.error);
      return res.status(400).json({ error: result.error });
    }

    if (!result.url) {
      console.error('No checkout URL generated');
      return res.status(500).json({ error: 'Failed to generate checkout URL' });
    }

    console.log('Checkout session created successfully, returning URL');
    return res.json({ url: result.url });
  } catch (error) {
    console.error('Checkout error:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to create checkout session' 
    });
  }
});

// Webhook test endpoint
router.post('/webhook-test', async (req, res) => {
  try {
    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      console.error('STRIPE_WEBHOOK_SECRET is not configured');
      return res.status(500).json({ error: 'Webhook secret not configured' });
    }

    // Log request details for debugging
    console.log('Webhook test request received');
    console.log('Headers:', req.headers);
    console.log('Body:', req.body);

    // Send a JSON response for the test endpoint
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

// Main webhook handler
router.post('/webhook', express.raw({type: 'application/json'}), async (req, res) => {
  try {
    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      console.error('STRIPE_WEBHOOK_SECRET is not configured');
      return res.status(500).json({ error: 'Webhook secret not configured' });
    }

    const sig = req.headers['stripe-signature'];

    if (!sig) {
      console.error('No Stripe signature in webhook request');
      return res.status(400).json({ error: 'No Stripe signature found' });
    }

    console.log('Received webhook event');
    console.log('Webhook signature:', sig);

    // Verify webhook signature
    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body, // raw body from express.raw middleware
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
      console.log('Webhook signature verified, event type:', event.type);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return res.status(400).json({ error: 'Webhook signature verification failed' });
    }

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        console.log('Processing checkout.session.completed:', session.id);

        // Extract metadata
        const userId = session.metadata?.userId;
        const planId = session.metadata?.planId;

        if (!userId || !planId) {
          console.error('Missing metadata in session:', session.id);
          return res.status(400).json({ error: 'Missing required metadata' });
        }

        console.log('Creating subscription record for user:', userId, 'plan:', planId);

        // Create subscription record
        await db.insert(subscriptions).values({
          userId: parseInt(userId),
          planId: parseInt(planId),
          stripeCustomerId: session.customer as string,
          stripeSubscriptionId: session.subscription as string,
          status: 'active',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1 day trial
          cancelAtPeriodEnd: false,
        });

        console.log('Subscription created successfully for session:', session.id);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(400).json({
      error: error instanceof Error ? error.message : 'Webhook processing failed'
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


export default router;