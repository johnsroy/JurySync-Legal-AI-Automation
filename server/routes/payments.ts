import { Router } from 'express';
import { stripeService, SUBSCRIPTION_PLANS } from '../services/stripe';
import { db } from '../db';
import { subscriptionPlans, subscriptions, studentEmailSchema } from '@shared/schema/subscriptions';
import { eq } from 'drizzle-orm';
import Stripe from 'stripe';

const router = Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

// Get subscription plans
router.get('/plans', async (req, res) => {
  try {
    const plans = await db.select().from(subscriptionPlans);
    res.json(plans);
  } catch (error) {
    console.error('Error fetching plans:', error);
    res.status(500).json({ error: 'Failed to fetch subscription plans' });
  }
});

// Create subscription
router.post('/create-subscription', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { planId, paymentMethodId, interval } = req.body;

    const plan = await db.query.subscriptionPlans.findFirst({
      where: eq(subscriptionPlans.id, planId)
    });

    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    // Create or get customer
    const customerId = await stripeService.createOrRetrieveCustomer(
      req.user.id,
      req.user.email,
      req.user.name
    );

    // If student plan, verify email
    if (plan.isStudent) {
      const isValidStudent = await stripeService.verifyStudentEmail(req.user.email);
      if (!isValidStudent) {
        return res.status(403).json({ error: 'Invalid student email' });
      }
    }

    // Attach payment method to customer if provided
    if (paymentMethodId) {
      await stripe.paymentMethods.attach(paymentMethodId, {
        customer: customerId,
      });

      // Set as default payment method
      await stripe.customers.update(customerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      });
    }

    // Create subscription
    const subscription = await stripeService.createSubscription({
      customerId,
      priceId: interval === 'year' ? plan.stripePriceIdYearly : plan.stripePriceIdMonthly,
      userId: req.user.id,
      planId: plan.id,
      isTrial: plan.isStudent
    });

    res.json({
      subscriptionId: subscription.id,
      clientSecret: (subscription as any).latest_invoice.payment_intent.client_secret
    });
  } catch (error) {
    console.error('Error creating subscription:', error);
    res.status(500).json({ error: 'Failed to create subscription' });
  }
});

// Update subscription
router.post('/update-subscription', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { subscriptionId, planId, interval } = req.body;

    const plan = await db.query.subscriptionPlans.findFirst({
      where: eq(subscriptionPlans.id, planId)
    });

    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    // If upgrading to student plan, verify email
    if (plan.isStudent) {
      const isValidStudent = await stripeService.verifyStudentEmail(req.user.email);
      if (!isValidStudent) {
        return res.status(403).json({ error: 'Invalid student email' });
      }
    }

    const updatedSubscription = await stripeService.updateSubscription(
      subscriptionId,
      interval === 'year' ? plan.stripePriceIdYearly : plan.stripePriceIdMonthly
    );

    res.json(updatedSubscription);
  } catch (error) {
    console.error('Error updating subscription:', error);
    res.status(500).json({ error: 'Failed to update subscription' });
  }
});

// Cancel subscription
router.post('/cancel-subscription', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { subscriptionId } = req.body;

    const subscription = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.stripeSubscriptionId, subscriptionId)
    });

    if (!subscription || subscription.userId !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const canceledSubscription = await stripeService.cancelSubscription(subscriptionId);
    res.json(canceledSubscription);
  } catch (error) {
    console.error('Error canceling subscription:', error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

// Verify student email
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

// Stripe webhook
router.post('/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];

  if (!sig || !endpointSecret) {
    return res.status(400).json({ error: 'Missing signature or endpoint secret' });
  }

  try {
    const event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);

    switch (event.type) {
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await db
          .update(subscriptions)
          .set({
            status: subscription.status,
            currentPeriodStart: new Date(subscription.current_period_start * 1000),
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
            updatedAt: new Date()
          })
          .where(eq(subscriptions.stripeSubscriptionId, subscription.id));
        break;
      }
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(400).json({ error: 'Webhook error' });
  }
});

export default router;
