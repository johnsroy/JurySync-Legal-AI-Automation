import { Router } from 'express';
import { stripeService } from '../services/stripe-service';
import { db } from '../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { stripe } from '../services/stripe';

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
    
    if (!priceId) {
      return res.status(400).json({ error: 'Price ID is required' });
    }

    const session = await stripeService.createCheckoutSession(req.user.id, priceId);
    
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