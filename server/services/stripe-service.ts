import Stripe from 'stripe';
import { db } from '../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import debug from 'debug';
import { PRICING_PLANS } from '@shared/schema/pricing';

const log = debug('jurysync:stripe-service');

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY must be set');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-01-27.acacia',
});

export const stripeService = {
  // Maintain backwards compatibility with existing price IDs
  _productIds: {} as Record<string, string>,
  _priceIds: {} as Record<string, string>,

  async ensureInitialized() {
    try {
      // List existing products and prices
      const products = await stripe.products.list({ active: true });
      const prices = await stripe.prices.list({ active: true });

      // Store existing mappings
      products.data.forEach(product => {
        if (product.metadata.planId) {
          this._productIds[product.metadata.planId] = product.id;
        }
      });

      prices.data.forEach(price => {
        if (price.metadata.planId) {
          this._priceIds[price.metadata.planId] = price.id;
        }
      });

      // Update PRICING_PLANS with actual Stripe price IDs
      PRICING_PLANS.forEach(plan => {
        if (this._priceIds[plan.id]) {
          plan.priceId = this._priceIds[plan.id];
        }
      });

      log('Stripe service initialized with:', {
        products: Object.keys(this._productIds).length,
        prices: Object.keys(this._priceIds).length
      });

    } catch (error) {
      log('Warning: Stripe initialization error:', error);
      // Don't throw - allow fallback to on-demand initialization
    }
  },

  async createCheckoutSession(userId: number, planId: string) {
    try {
      log(`Creating checkout session for user ${userId} and plan ${planId}`);

      // Get user
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId));

      if (!user) {
        return {
          success: false,
          error: 'User not found'
        };
      }

      // Find the plan
      const plan = PRICING_PLANS.find(p => p.id === planId);
      if (!plan) {
        return {
          success: false,
          error: 'Invalid plan selected'
        };
      }

      // Ensure price ID exists
      if (!plan.priceId) {
        await this.ensureInitialized();
      }

      if (!plan.priceId) {
        return {
          success: false,
          error: 'Price not initialized yet. Please try again in a few moments.'
        };
      }

      // Create or get Stripe customer
      let customerId = user.stripeCustomerId;

      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          metadata: {
            userId: user.id.toString()
          }
        });

        customerId = customer.id;

        // Update user with Stripe customer ID
        await db
          .update(users)
          .set({ stripeCustomerId: customerId })
          .where(eq(users.id, userId));
      }

      // Create checkout session
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        mode: 'subscription',
        line_items: [
          {
            price: plan.priceId,
            quantity: 1,
          },
        ],
        success_url: `${process.env.CLIENT_URL}/dashboard?success=true`,
        cancel_url: `${process.env.CLIENT_URL}/subscription?canceled=true`,
        allow_promotion_codes: true,
        billing_address_collection: 'required',
      });

      return {
        success: true,
        sessionId: session.id,
        url: session.url
      };

    } catch (error) {
      log('Stripe checkout error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create checkout session'
      };
    }
  },

  async createCustomerPortalSession(customerId: string) {
    try {
      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${process.env.CLIENT_URL}/settings`,
      });
      return session;
    } catch (error) {
      log('Customer portal session error:', error);
      throw error;
    }
  },

  async handleWebhook(signature: string, rawBody: Buffer) {
    try {
      const event = stripe.webhooks.constructEvent(
        rawBody,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET || ''
      );

      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object as Stripe.Checkout.Session;
          await this.handleSuccessfulCheckout(session);
          break;
        }
        case 'customer.subscription.deleted': {
          const subscription = event.data.object as Stripe.Subscription;
          await this.handleSubscriptionCanceled(subscription);
          break;
        }
      }

      return { received: true };
    } catch (error) {
      log('Webhook error:', error);
      throw error;
    }
  },

  async handleSuccessfulCheckout(session: Stripe.Checkout.Session) {
    const userId = session.metadata?.userId;
    if (!userId) return;

    await db
      .update(users)
      .set({
        subscriptionStatus: 'active',
        stripePriceId: session.subscription as string
      })
      .where(eq(users.id, parseInt(userId)));
  },

  async handleSubscriptionCanceled(subscription: Stripe.Subscription) {
    const customerId = subscription.customer as string;

    await db
      .update(users)
      .set({
        subscriptionStatus: 'inactive'
      })
      .where(eq(users.stripeCustomerId, customerId));
  }
};