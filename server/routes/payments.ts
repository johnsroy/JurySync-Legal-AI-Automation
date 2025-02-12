import { Router } from 'express';
import { stripe, stripeService } from '../services/stripe';
import getRawBody from 'raw-body';

const router = Router();

// Stripe webhook handler
router.post('/webhook', async (req, res) => {
  try {
    const rawBody = await getRawBody(req);
    const sig = req.headers['stripe-signature'];

    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      return res.status(500).send('Webhook secret not configured');
    }

    const event = stripe.webhooks.constructEvent(
      rawBody,
      sig!,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object;
        console.log('Payment successful, session:', session);
        // Handle successful payment
        break;
      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(400).send(`Webhook Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
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

// Create a checkout session
router.post('/create-checkout-session', async (req, res) => {
  try {
    const session = await stripeService.createCheckoutSession({
      successUrl: `${process.env.APP_URL}/subscription?success=true`,
      cancelUrl: `${process.env.APP_URL}/subscription?canceled=true`,
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to create checkout session'
    });
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

export default router;