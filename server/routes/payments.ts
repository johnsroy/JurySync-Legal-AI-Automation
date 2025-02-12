import { Router } from 'express';
import { stripe } from '../services/stripe';
import getRawBody from 'raw-body';

const router = Router();

// Simple checkout session creation
router.post('/create-checkout-session', async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          // Provide the exact Price ID (e.g. pr_1234) of your product
          price: 'price_1OiXXXXXXXXXXXXXXXXXXXXX',
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.APP_URL}/subscription?success=true`,
      cancel_url: `${process.env.APP_URL}/subscription?canceled=true`,
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Stripe webhook handler
router.post('/webhook', async (req, res) => {
  const payload = await getRawBody(req);
  const sig = req.headers['stripe-signature'];

  let event;

  try {
    event = stripe.webhooks.constructEvent(payload, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook Error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the checkout.session.completed event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    console.log('Payment successful:', session);
  }

  res.status(200).json({ received: true });
});

export default router;