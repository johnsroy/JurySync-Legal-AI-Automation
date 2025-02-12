import { Router } from 'express';
import { paymentsAgent } from '../agents/paymentsAgent';
import { stripe } from '../services/stripe';
import { db } from '../db';
import { eq } from 'drizzle-orm';
import { subscriptions, subscriptionPlans } from '@shared/schema/subscriptions';
import { z } from 'zod';

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

    const result = await paymentsAgent.initializeCheckout(
      req.user,
      planId,
      interval
    );

    if (!result.success) {
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
    const result = await paymentsAgent.getSubscriptionStatus(req.user);

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
    const result = await paymentsAgent.cancelSubscription(req.user);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error canceling subscription:', error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

// Get billing history
router.get('/billing-history', requireAuth, async (req, res) => {
  try {
    const result = await paymentsAgent.getBillingHistory(req.user);

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json(result.invoices);
  } catch (error) {
    console.error('Error fetching billing history:', error);
    res.status(500).json({ error: 'Failed to fetch billing history' });
  }
});

// Verify student email
const studentEmailSchema = z.object({
  email: z.string().email().endsWith('.edu')
});

router.post('/verify-student', async (req, res) => {
  try {
    const { email } = req.body;
    const result = studentEmailSchema.safeParse({ email });

    if (!result.success) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const isValid = await stripeService.verifyStudentEmail(email);
    res.json({ isValid });
  } catch (error) {
    console.error('Error verifying student email:', error);
    res.status(500).json({ error: 'Failed to verify student email' });
  }
});

// Stripe webhook handler
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

router.post('/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];

  try {
    const event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const subscription = await stripe.subscriptions.retrieve(session.subscription as string);

        // Record the subscription in our database
        await db.insert(subscriptions).values({
          userId: parseInt(session.metadata?.userId || '0'),
          planId: parseInt(session.metadata?.planId || '0'),
          stripeCustomerId: session.customer as string,
          stripeSubscriptionId: subscription.id,
          status: subscription.status,
          currentPeriodStart: new Date(subscription.current_period_start * 1000),
          currentPeriodEnd: new Date(subscription.current_period_end * 1000)
        });
        break;
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        await db
          .update(subscriptions)
          .set({
            status: subscription.status,
            currentPeriodStart: new Date(subscription.current_period_start * 1000),
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
            cancelAtPeriodEnd: subscription.cancel_at_period_end
          })
          .where(eq(subscriptions.stripeSubscriptionId, subscription.id));
        break;
      }
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(400).send(`Webhook Error: ${error.message}`);
  }
});

export default router;