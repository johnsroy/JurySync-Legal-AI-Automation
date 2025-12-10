import Stripe from 'stripe';
import { Request, Response } from 'express';
import { PRICING_PLANS, type Plan } from '@shared/schema/pricing';
import { db } from './db';
import { subscriptions, users } from '@shared/schema';
import { eq } from 'drizzle-orm';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing Stripe secret key');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

// Convert our pricing plans to Stripe format
const PRODUCTS = PRICING_PLANS.reduce((acc, plan) => {
  if (plan.tier === 'enterprise') return acc; // Skip enterprise as it's custom priced

  acc[plan.id] = {
    price: plan.price * 100, // Convert to cents
    name: plan.name,
    interval: plan.interval,
  };
  return acc;
}, {} as Record<string, {
  price: number;
  name: string;
  interval: 'month' | 'year';
}>);

export async function createCheckoutSession(req: Request, res: Response) {
  try {
    const { planType } = req.body;

    if (!planType || !PRODUCTS[planType]) {
      return res.status(400).json({ error: 'Invalid plan type' });
    }

    const product = PRODUCTS[planType];

    // Create Stripe session with trial period
    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: product.name,
              description: `JurySync.io ${product.name} Subscription`,
            },
            unit_amount: product.price,
            recurring: {
              interval: product.interval,
            },
          },
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${req.headers.origin}/dashboard?session_id={CHECKOUT_SESSION_ID}&success=true`,
      cancel_url: `${req.headers.origin}/pricing?canceled=true`,
      customer_creation: 'always',
      payment_method_types: ['card', 'us_bank_account'],
      billing_address_collection: 'required',
      allow_promotion_codes: true,
      automatic_tax: { enabled: true },
      tax_id_collection: { enabled: true },
      metadata: {
        planType,
      },
    });

    res.json({ sessionId: session.id });
  } catch (err: any) {
    console.error('Error creating checkout session:', err);
    res.status(500).json({ error: 'Error creating checkout session', details: err.message });
  }
}

export async function createPortalSession(req: Request, res: Response) {
  try {
    const { customerId } = req.body;

    if (!customerId) {
      return res.status(400).json({ error: 'Customer ID is required' });
    }

    // Create a billing portal session
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${req.headers.origin}/dashboard`,
      configuration: {
        features: {
          payment_method_update: { enabled: true },
          customer_update: { 
            enabled: true,
            allowed_updates: ['email', 'address', 'phone'],
          },
          invoice_history: { enabled: true },
          subscription_cancel: { enabled: true },
          subscription_pause: { enabled: true },
        },
      },
    });

    res.json({ url: portalSession.url });
  } catch (err: any) {
    console.error('Error creating portal session:', err);
    res.status(500).json({ error: 'Error creating portal session', details: err.message });
  }
}

// Handle Stripe webhooks
export async function handleWebhook(req: Request, res: Response) {
  const sig = req.headers['stripe-signature'];

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    throw new Error('Missing Stripe webhook secret');
  }

  try {
    const event = stripe.webhooks.constructEvent(
      req.body,
      sig as string,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    // Handle specific webhook events
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        const subscription = event.data.object as Stripe.Subscription;
        // Update user's subscription status in your database
        await handleSubscriptionChange(subscription);
        break;

      case 'invoice.paid':
        const invoice = event.data.object as Stripe.Invoice;
        // Handle successful payment
        await handleSuccessfulPayment(invoice);
        break;

      case 'invoice.payment_failed':
        // Handle failed payment
        await handleFailedPayment(event.data.object as Stripe.Invoice);
        break;
    }

    res.json({ received: true });
  } catch (err: any) {
    console.error('Webhook error:', err);
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
}

async function handleSubscriptionChange(subscription: Stripe.Subscription) {
  console.log('Subscription changed:', subscription.id, subscription.status);

  try {
    // Get the customer ID to find the associated user
    const customerId = subscription.customer as string;

    // Find the user by their Stripe customer ID
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.stripeCustomerId, customerId))
      .limit(1);

    if (!user) {
      console.log('No user found for customer:', customerId);
      return;
    }

    // Map Stripe subscription status to our status
    let subscriptionStatus: string;
    switch (subscription.status) {
      case 'active':
        subscriptionStatus = 'ACTIVE';
        break;
      case 'canceled':
        subscriptionStatus = 'CANCELED';
        break;
      case 'past_due':
        subscriptionStatus = 'PAST_DUE';
        break;
      case 'trialing':
        subscriptionStatus = 'TRIAL';
        break;
      case 'unpaid':
        subscriptionStatus = 'UNPAID';
        break;
      default:
        subscriptionStatus = 'INACTIVE';
    }

    // Update user subscription status
    await db
      .update(users)
      .set({
        subscriptionStatus,
        subscriptionEndsAt: subscription.current_period_end
          ? new Date(subscription.current_period_end * 1000)
          : null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    // Check if we have an existing subscription record
    const [existingSubscription] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.stripeSubscriptionId, subscription.id))
      .limit(1);

    if (existingSubscription) {
      // Update existing subscription
      await db
        .update(subscriptions)
        .set({
          status: subscriptionStatus,
          currentPeriodStart: new Date(subscription.current_period_start * 1000),
          currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
        })
        .where(eq(subscriptions.id, existingSubscription.id));
    }

    console.log(`Updated subscription status for user ${user.id}: ${subscriptionStatus}`);
  } catch (error) {
    console.error('Error handling subscription change:', error);
    throw error;
  }
}

async function handleSuccessfulPayment(invoice: Stripe.Invoice) {
  console.log('Payment succeeded:', invoice.id);

  try {
    const customerId = invoice.customer as string;
    const subscriptionId = invoice.subscription as string;

    // Find user by customer ID
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.stripeCustomerId, customerId))
      .limit(1);

    if (!user) {
      console.log('No user found for customer:', customerId);
      return;
    }

    // Update user's last payment date and ensure subscription is active
    await db
      .update(users)
      .set({
        subscriptionStatus: 'ACTIVE',
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    // Update subscription if exists
    if (subscriptionId) {
      await db
        .update(subscriptions)
        .set({
          status: 'ACTIVE',
        })
        .where(eq(subscriptions.stripeSubscriptionId, subscriptionId));
    }

    console.log(`Payment processed successfully for user ${user.id}`);
  } catch (error) {
    console.error('Error handling successful payment:', error);
    throw error;
  }
}

async function handleFailedPayment(invoice: Stripe.Invoice) {
  console.log('Payment failed:', invoice.id);

  try {
    const customerId = invoice.customer as string;
    const subscriptionId = invoice.subscription as string;

    // Find user by customer ID
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.stripeCustomerId, customerId))
      .limit(1);

    if (!user) {
      console.log('No user found for customer:', customerId);
      return;
    }

    // Update user status to indicate payment failure
    await db
      .update(users)
      .set({
        subscriptionStatus: 'PAST_DUE',
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    // Update subscription status
    if (subscriptionId) {
      await db
        .update(subscriptions)
        .set({
          status: 'PAST_DUE',
        })
        .where(eq(subscriptions.stripeSubscriptionId, subscriptionId));
    }

    // TODO: Consider sending email notification to user about failed payment
    console.log(`Payment failed for user ${user.id}, status updated to PAST_DUE`);
  } catch (error) {
    console.error('Error handling failed payment:', error);
    throw error;
  }
}