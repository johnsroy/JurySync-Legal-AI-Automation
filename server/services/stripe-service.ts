import Stripe from 'stripe';
import { db } from '../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { PRICING_PLANS } from '@shared/schema/pricing';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing Stripe secret key');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

class StripeService {
  private productIds: Record<string, string> = {};
  private priceIds: Record<string, string> = {};

  constructor() {
    this.initializeProducts().catch(console.error);
  }

  private async initializeProducts() {
    try {
      // Create products and prices for each plan
      for (const plan of PRICING_PLANS) {
        if (plan.tier === 'enterprise') continue; // Skip enterprise as it's custom priced

        // Create or get product
        const productName = `JurySync ${plan.name}`;
        let product = (await stripe.products.list({ active: true }))
          .data.find(p => p.name === productName);

        if (!product) {
          product = await stripe.products.create({
            name: productName,
            description: plan.description,
          });
        }

        this.productIds[plan.id] = product.id;

        // Create or get price
        let price = (await stripe.prices.list({ 
          product: product.id,
          active: true,
          type: 'recurring',
        })).data.find(p => 
          p.recurring?.interval === plan.interval && 
          p.unit_amount === plan.price * 100
        );

        if (!price) {
          price = await stripe.prices.create({
            product: product.id,
            currency: 'usd',
            unit_amount: plan.price * 100,
            recurring: {
              interval: plan.interval,
            },
          });
        }

        this.priceIds[plan.id] = price.id;
      }

      console.log('Stripe products and prices initialized:', {
        productIds: this.productIds,
        priceIds: this.priceIds
      });
    } catch (error) {
      console.error('Failed to initialize Stripe products:', error);
      throw error;
    }
  }

  async createCheckoutSession(userId: number, planId: string) {
    try {
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

      const priceId = this.priceIds[planId];
      if (!priceId) {
        return {
          success: false,
          error: 'Invalid plan selected'
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
        success_url: `${process.env.CLIENT_URL}/dashboard`,
        cancel_url: `${process.env.CLIENT_URL}/subscription/cancel`,
        allow_promotion_codes: true,
        billing_address_collection: 'required',
      });

      return {
        success: true,
        sessionId: session.id,
        url: session.url
      };
    } catch (error) {
      console.error('Stripe checkout error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create checkout session'
      };
    }
  }

  async createCustomerPortalSession(customerId: string) {
    try {
      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${process.env.CLIENT_URL}/settings`,
      });
      return session;
    } catch (error) {
      console.error('Customer portal session error:', error);
      throw error;
    }
  }

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
          const customerId = session.customer as string;

          if (customerId) {
            const [user] = await db
              .select()
              .from(users)
              .where(eq(users.stripeCustomerId, customerId));

            if (user) {
              await db
                .update(users)
                .set({
                  subscriptionStatus: 'active',
                })
                .where(eq(users.id, user.id));
            }
          }
          break;
        }

        case 'customer.subscription.deleted': {
          const subscription = event.data.object as Stripe.Subscription;
          const customerId = subscription.customer as string;

          if (customerId) {
            await db
              .update(users)
              .set({
                subscriptionStatus: 'inactive',
              })
              .where(eq(users.stripeCustomerId, customerId));
          }
          break;
        }
      }

      return { received: true };
    } catch (error) {
      console.error('Webhook error:', error);
      throw error;
    }
  }
}

export const stripeService = new StripeService();