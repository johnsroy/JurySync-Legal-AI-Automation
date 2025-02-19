import { Router } from 'express';
import { stripeService } from '../services/stripe-service';
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

export default router; 