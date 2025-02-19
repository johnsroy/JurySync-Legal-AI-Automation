import { Router } from 'express';
import { stripe, STRIPE_PRICE_IDS } from '../services/stripe';
import { db } from '../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';

const router = Router();

// Start free trial
router.post('/trial', async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, req.user.id));

    if (user?.trialUsed) {
      return res.status(400).json({ error: 'Trial already used' });
    }

    await stripeService.createTrialSubscription(req.user.id);

    res.json({ success: true });
  } catch (error) {
    console.error('Trial error:', error);
    res.status(500).json({ error: 'Failed to start trial' });
  }
});

// Create checkout session
router.post('/create-checkout-session', async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { priceId } = req.body;
    
    // Validate price ID
    if (!Object.values(STRIPE_PRICE_IDS).includes(priceId)) {
      return res.status(400).json({ error: 'Invalid price ID' });
    }

    // Get or create Stripe customer
    let customerId = req.user.stripeCustomerId;
    
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: req.user.email,
        metadata: {
          userId: req.user.id.toString()
        }
      });
      
      customerId = customer.id;
      
      // Update user with Stripe customer ID
      await db
        .update(users)
        .set({ stripeCustomerId: customerId })
        .where(eq(users.id, req.user.id));
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.CLIENT_URL}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL}/subscription/cancel`,
      subscription_data: {
        trial_period_days: 1,
      },
      allow_promotion_codes: true,
      billing_address_collection: 'required',
    });

    res.json({ sessionId: session.id });
  } catch (error) {
    console.error('Checkout error:', error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// Verify subscription
router.get('/verify/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Retrieve the session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Update user subscription status
    await db
      .update(users)
      .set({
        subscriptionStatus: 'ACTIVE',
        subscriptionEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        stripePriceId: session.subscription as string
      })
      .where(eq(users.id, req.user.id));

    res.json({ success: true });
  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({ error: 'Failed to verify subscription' });
  }
});

export default router; 