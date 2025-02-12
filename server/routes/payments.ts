import { Router } from 'express';
import { stripeService } from '../services/stripe';
import { handleStripeWebhook } from '../webhooks/stripe';
import * as express from 'express';

const router = Router();

// Configure webhook endpoint with raw body parsing
router.post('/webhook', express.raw({ type: 'application/json' }), handleStripeWebhook);

// Webhook test endpoint
router.post('/webhook-test', async (req: express.Request, res: express.Response) => {
  try {
    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      return res.status(500).json({ error: 'Webhook secret not configured' });
    }

    console.log('Headers:', req.headers);
    console.log('Body:', req.body);

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

router.post('/create-payment-link', async (req: express.Request, res: express.Response) => {
  try {
    const { priceId } = req.body;

    if (!priceId) {
      return res.status(400).json({ error: 'Price ID is required' });
    }

    const result = await stripeService.createPaymentLink(priceId);

    if (!result.success || !result.url) {
      return res.status(400).json({ error: result.error || 'Failed to create payment link' });
    }

    return res.json({ url: result.url });
  } catch (error) {
    console.error('Payment link creation error:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to create payment link' 
    });
  }
});

export default router;