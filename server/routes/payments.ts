import { Router } from 'express';
import { stripeService } from '../services/stripe-service';
import { db } from '../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { type Request, Response } from 'express';

const router = Router();

// Create checkout session
router.post('/create-checkout-session', async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    const { priceId } = req.body;
    if (!priceId) {
      return res.status(400).json({
        success: false,
        error: 'Price ID is required'
      });
    }

    const result = await stripeService.createCheckoutSession(req.user.id, priceId);
    
    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.json(result);

  } catch (error) {
    console.error('Checkout error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create checkout session'
    });
  }
});

// Webhook handler
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const signature = req.headers['stripe-signature'];
    if (!signature || typeof signature !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'No valid signature found'
      });
    }

    const result = await stripeService.handleWebhook(signature, req.rawBody);
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(400).json({
      success: false,
      error: 'Webhook error'
    });
  }
});

// Get customer portal session
router.post('/create-portal-session', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, req.user.id));

    if (!user?.stripeCustomerId) {
      return res.status(400).json({
        success: false,
        error: 'No Stripe customer found'
      });
    }

    const session = await stripeService.createCustomerPortalSession(user.stripeCustomerId);
    res.json({
      success: true,
      session
    });
  } catch (error) {
    console.error('Portal session error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create portal session'
    });
  }
});

export default router;