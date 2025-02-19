import { Router } from 'express';
import { stripe } from '../services/stripe';
import { db } from '../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';

const router = Router();

router.post('/stripe', async (req, res) => {
  const sig = req.headers['stripe-signature'];

  try {
    const event = stripe.webhooks.constructEvent(
      req.body,
      sig!,
      process.env.STRIPE_WEBHOOK_SECRET!
    );

    switch (event.type) {
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object);
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(400).send(`Webhook Error: ${error.message}`);
  }
});

async function handleSubscriptionCreated(subscription: any) {
  const customerId = subscription.customer;
  
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.stripeCustomerId, customerId));

  if (user) {
    await db
      .update(users)
      .set({
        subscriptionStatus: 'ACTIVE',
        stripePriceId: subscription.items.data[0].price.id,
        subscriptionEndsAt: new Date(subscription.current_period_end * 1000)
      })
      .where(eq(users.id, user.id));
  }
}

// Add other handlers...

export default router; 