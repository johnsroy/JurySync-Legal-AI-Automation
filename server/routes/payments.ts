import { Router } from 'express';
import { stripe } from '../services/stripe';
import getRawBody from 'raw-body';

const router = Router();

// Simple checkout session creation
router.post('/create-checkout-session', async (req, res) => {
  try {
    console.log('Creating checkout session...');

    // Create Stripe checkout session with basic payment configuration
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Student Plan',
              description: 'Access to legal research tools',
            },
            unit_amount: 2400, // $24.00
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.APP_URL}/subscription?success=true`,
      cancel_url: `${process.env.APP_URL}/subscription?canceled=true`,
    });

    console.log('Checkout session created:', session.id);
    res.json({ url: session.url });
  } catch (error) {
    console.error('Stripe error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to create checkout session' 
    });
  }
});

// Webhook handling
router.post('/webhook', async (req, res) => {
  try {
    const rawBody = await getRawBody(req);
    const sig = req.headers['stripe-signature'];

    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      console.error('Webhook secret not configured');
      return res.status(500).send('Webhook secret not configured');
    }

    const event = stripe.webhooks.constructEvent(
      rawBody,
      sig!,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object;
        console.log('Payment successful, session:', session);
        break;
      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Webhook Error:', err);
    return res.status(400).send(
      `Webhook Error: ${err instanceof Error ? err.message : 'Unknown error'}`
    );
  }
});

export default router;