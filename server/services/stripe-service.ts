import Stripe from 'stripe';
import { db } from '../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import debug from 'debug';

const log = debug('jurysync:stripe-service');

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY must be set');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-01-27.acacia',
});

export const stripeService = {
  // Lazy-loaded product and price IDs
  _productIds: null as Record<string, string> | null,
  _priceIds: null as Record<string, string> | null,

  async getProductIds() {
    if (!this._productIds) {
      await this.initializeProducts();
    }
    return this._productIds;
  },

  async getPriceIds() {
    if (!this._priceIds) {
      await this.initializeProducts();
    }
    return this._priceIds;
  },

  async initializeProducts() {
    if (this._productIds && this._priceIds) {
      return; // Already initialized
    }

    log('Initializing Stripe products and prices...');
    this._productIds = {};
    this._priceIds = {};

    try {
      // List existing products and prices
      const products = await stripe.products.list({ active: true });
      const prices = await stripe.prices.list({ active: true });

      products.data.forEach(product => {
        if (product.metadata.planId) {
          this._productIds![product.metadata.planId] = product.id;
        }
      });

      prices.data.forEach(price => {
        if (price.product && typeof price.product === 'string' && price.metadata.planId) {
          this._priceIds![price.metadata.planId] = price.id;
        }
      });

      log('Stripe products and prices initialized:', {
        productCount: Object.keys(this._productIds).length,
        priceCount: Object.keys(this._priceIds).length
      });

    } catch (error) {
      log('Error initializing Stripe products:', error);
      throw error;
    }
  },

  async createCheckoutSession(userId: number, priceId: string) {
    try {
      log(`Creating checkout session for user ${userId} and price ${priceId}`);

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
            price: priceId,
            quantity: 1,
          },
        ],
        success_url: `${process.env.CLIENT_URL}/dashboard?success=true`,
        cancel_url: `${process.env.CLIENT_URL}/subscription?canceled=true`,
        allow_promotion_codes: true,
        billing_address_collection: 'required',
        metadata: {
          userId: userId.toString()
        }
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

  private async handleSuccessfulCheckout(session: Stripe.Checkout.Session) {
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

  private async handleSubscriptionCanceled(subscription: Stripe.Subscription) {
    const customerId = subscription.customer as string;

    await db
      .update(users)
      .set({
        subscriptionStatus: 'inactive'
      })
      .where(eq(users.stripeCustomerId, customerId));
  }
};