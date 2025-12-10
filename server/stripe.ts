import Stripe from 'stripe';
import { Request, Response } from 'express';
import { PRICING_PLANS, type Plan } from '@shared/schema/pricing';

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
  try {
    const customerId = subscription.customer as string;
    const status = subscription.status;
    const priceId = subscription.items.data[0]?.price.id;
    const currentPeriodEnd = new Date(subscription.current_period_end * 1000);
    const cancelAtPeriodEnd = subscription.cancel_at_period_end;

    console.log('Processing subscription change:', {
      subscriptionId: subscription.id,
      customerId,
      status,
      priceId
    });

    // Import db and users table dynamically to avoid circular dependencies
    const { db } = await import('./db');
    const { users } = await import('@shared/schema');
    const { eq } = await import('drizzle-orm');

    // Map Stripe status to our subscription status
    let subscriptionStatus: string;
    switch (status) {
      case 'active':
        subscriptionStatus = 'ACTIVE';
        break;
      case 'past_due':
        subscriptionStatus = 'PAST_DUE';
        break;
      case 'canceled':
      case 'unpaid':
        subscriptionStatus = 'CANCELLED';
        break;
      case 'trialing':
        subscriptionStatus = 'TRIAL';
        break;
      case 'incomplete':
      case 'incomplete_expired':
        subscriptionStatus = 'INCOMPLETE';
        break;
      default:
        subscriptionStatus = 'UNKNOWN';
    }

    // Find and update user by Stripe customer ID
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.stripeCustomerId, customerId))
      .limit(1);

    if (existingUser) {
      await db
        .update(users)
        .set({
          subscriptionStatus,
          stripePriceId: priceId,
          subscriptionEndsAt: currentPeriodEnd,
          updatedAt: new Date()
        })
        .where(eq(users.id, existingUser.id));

      console.log(`Updated subscription for user ${existingUser.id}: ${subscriptionStatus}`);
    } else {
      console.warn(`No user found with Stripe customer ID: ${customerId}`);
    }

    // Also update/insert into subscriptions table if it exists
    try {
      const { subscriptions } = await import('@shared/schema');

      const subscriptionRecord = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.stripeSubscriptionId, subscription.id))
        .limit(1);

      if (subscriptionRecord.length > 0) {
        await db
          .update(subscriptions)
          .set({
            status: subscriptionStatus,
            currentPeriodEnd,
            cancelAtPeriodEnd,
            updatedAt: new Date()
          })
          .where(eq(subscriptions.stripeSubscriptionId, subscription.id));
      }
    } catch (e) {
      // Subscriptions table may not exist, that's okay
      console.log('Subscriptions table not available, skipping');
    }

  } catch (error) {
    console.error('Error handling subscription change:', error);
    throw error;
  }
}

async function handleSuccessfulPayment(invoice: Stripe.Invoice) {
  try {
    const customerId = invoice.customer as string;
    const amountPaid = invoice.amount_paid;
    const invoiceId = invoice.id;
    const subscriptionId = invoice.subscription as string;

    console.log('Processing successful payment:', {
      invoiceId,
      customerId,
      amountPaid: amountPaid / 100, // Convert cents to dollars
      subscriptionId
    });

    // Import db dynamically
    const { db } = await import('./db');
    const { users } = await import('@shared/schema');
    const { eq } = await import('drizzle-orm');

    // Find user and update their status
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.stripeCustomerId, customerId))
      .limit(1);

    if (existingUser) {
      // Update user's subscription status to ACTIVE on successful payment
      await db
        .update(users)
        .set({
          subscriptionStatus: 'ACTIVE',
          trialUsed: true,
          updatedAt: new Date()
        })
        .where(eq(users.id, existingUser.id));

      console.log(`Payment successful for user ${existingUser.id}, subscription activated`);
    } else {
      console.warn(`No user found with Stripe customer ID: ${customerId}`);
    }

    // Log payment in metrics if available
    try {
      const { metricsEvents } = await import('@shared/schema');
      await db.insert(metricsEvents).values({
        userId: existingUser?.id || 0,
        modelId: 'stripe',
        taskType: 'payment_successful',
        processingTimeMs: 0,
        successful: true,
        costSavingEstimate: amountPaid,
        timestamp: new Date()
      });
    } catch (e) {
      // Metrics table may not exist
    }

  } catch (error) {
    console.error('Error handling successful payment:', error);
    throw error;
  }
}

async function handleFailedPayment(invoice: Stripe.Invoice) {
  try {
    const customerId = invoice.customer as string;
    const invoiceId = invoice.id;
    const attemptCount = invoice.attempt_count;

    console.log('Processing failed payment:', {
      invoiceId,
      customerId,
      attemptCount
    });

    // Import db dynamically
    const { db } = await import('./db');
    const { users } = await import('@shared/schema');
    const { eq } = await import('drizzle-orm');

    // Find user and update their status
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.stripeCustomerId, customerId))
      .limit(1);

    if (existingUser) {
      // Update user's subscription status to PAST_DUE on failed payment
      await db
        .update(users)
        .set({
          subscriptionStatus: 'PAST_DUE',
          updatedAt: new Date()
        })
        .where(eq(users.id, existingUser.id));

      console.log(`Payment failed for user ${existingUser.id}, subscription marked as past due`);

      // If this is a repeated failure (3+ attempts), consider suspending access
      if (attemptCount >= 3) {
        await db
          .update(users)
          .set({
            subscriptionStatus: 'SUSPENDED',
            updatedAt: new Date()
          })
          .where(eq(users.id, existingUser.id));

        console.log(`User ${existingUser.id} suspended after ${attemptCount} failed payment attempts`);
      }
    } else {
      console.warn(`No user found with Stripe customer ID: ${customerId}`);
    }

  } catch (error) {
    console.error('Error handling failed payment:', error);
    throw error;
  }
}