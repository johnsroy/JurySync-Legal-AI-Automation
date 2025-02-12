import { Router } from 'express';
import { stripe, stripeService } from '../services/stripe';
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

    const plan = await db.query.subscriptionPlans.findFirst({
      where: eq(subscriptionPlans.id, planId)
    });

    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    // If student plan, verify email
    if (plan.isStudent) {
      const isValidStudent = await stripeService.verifyStudentEmail(req.user.email);
      if (!isValidStudent) {
        return res.status(403).json({ error: 'Invalid student email. Must be a .edu email address.' });
      }
    }

    // Create or get customer
    const customerId = await stripeService.getOrCreateCustomer(
      req.user.email,
      req.user.stripeCustomerId,
      req.user.name
    );

    // Create checkout session
    const session = await stripeService.createCheckoutSession({
      customerId,
      priceId: interval === 'year' ? plan.stripePriceIdYearly : plan.stripePriceIdMonthly,
      userId: req.user.id,
      planId: plan.id,
      isTrial: plan.isStudent,
      successUrl: `${process.env.APP_URL}/subscription-management?success=true`,
      cancelUrl: `${process.env.APP_URL}/subscription?canceled=true`
    });

    res.json({ sessionId: session.id });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// Get current subscription
router.get('/current-subscription', requireAuth, async (req, res) => {
  try {
    const subscription = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, req.user.id),
      with: {
        plan: true
      }
    });

    if (!subscription) {
      return res.json(null);
    }

    const stripeSubscription = await stripeService.getSubscriptionDetails(
      subscription.stripeSubscriptionId
    );

    res.json({
      ...subscription,
      stripeSubscription
    });
  } catch (error) {
    console.error('Error fetching subscription:', error);
    res.status(500).json({ error: 'Failed to fetch subscription' });
  }
});

// Cancel subscription
router.post('/cancel-subscription', requireAuth, async (req, res) => {
  try {
    const subscription = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, req.user.id)
    });

    if (!subscription) {
      return res.status(404).json({ error: 'No active subscription found' });
    }

    const updatedSubscription = await stripeService.cancelSubscription(
      subscription.stripeSubscriptionId
    );

    await db
      .update(subscriptions)
      .set({ cancelAtPeriodEnd: true })
      .where(eq(subscriptions.id, subscription.id));

    res.json(updatedSubscription);
  } catch (error) {
    console.error('Error canceling subscription:', error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

// Get billing history
router.get('/billing-history', requireAuth, async (req, res) => {
  try {
    const subscription = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, req.user.id)
    });

    if (!subscription) {
      return res.json([]);
    }

    const invoices = await stripeService.getBillingHistory(subscription.stripeCustomerId);
    res.json(invoices);
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
        const session = event.data.object as Stripe.Checkout.Session;
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
        const subscription = event.data.object as Stripe.Subscription;
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