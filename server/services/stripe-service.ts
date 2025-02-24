import Stripe from 'stripe';
import { db } from '../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { PRICING_PLANS } from '@shared/schema/pricing';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing Stripe secret key');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-01-27.acacia',
});

class StripeService {
  private productIds: Record<string, string> = {};
  private priceIds: Record<string, string> = {};

  constructor() {
    this.initializeProducts().catch(console.error);
  }

  private async initializeProducts() {
    try {
      console.log('Starting Stripe products initialization...');

      // Create products and prices for each plan
      for (const plan of PRICING_PLANS) {
        if (plan.tier === 'enterprise') continue; // Skip enterprise as it's custom priced

        try {
          // Create or get product
          const productName = `JurySync ${plan.name}`;
          console.log(`Setting up product: ${productName}`);

          let product = (await stripe.products.list({ active: true }))
            .data.find(p => p.name === productName);

          if (!product) {
            console.log(`Creating new product: ${productName}`);
            product = await stripe.products.create({
              name: productName,
              description: plan.description,
            });
          }

          this.productIds[plan.id] = product.id;
          console.log(`Product ID for ${plan.id}: ${product.id}`);

          // Create or get price
          console.log(`Setting up price for ${plan.id} - ${plan.interval} at ${plan.price}`);
          let price = (await stripe.prices.list({ 
            product: product.id,
            active: true,
            type: 'recurring',
          })).data.find(p => 
            p.recurring?.interval === plan.interval && 
            p.unit_amount === plan.price * 100
          );

          if (!price) {
            console.log(`Creating new price for ${plan.id}`);
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
          console.log(`Price ID for ${plan.id}: ${price.id}`);

          // Update the PRICING_PLANS array with the actual Stripe price ID
          const planIndex = PRICING_PLANS.findIndex(p => p.id === plan.id);
          if (planIndex !== -1) {
            PRICING_PLANS[planIndex].priceId = price.id;
            console.log(`Updated PRICING_PLANS[${planIndex}].priceId = ${price.id}`);
          }
        } catch (planError) {
          console.error(`Error setting up plan ${plan.id}:`, planError);
        }
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
      console.log(`Creating checkout session for user ${userId} and plan ${planId}`);

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

      // Find the plan in PRICING_PLANS
      const plan = PRICING_PLANS.find(p => p.id === planId);
      if (!plan) {
        console.error(`Plan not found: ${planId}`);
        return {
          success: false,
          error: 'Invalid plan selected'
        };
      }

      console.log('Found plan:', plan);

      const priceId = plan.priceId || this.priceIds[planId];
      if (!priceId) {
        console.error(`No price ID found for plan ${planId}`);
        return {
          success: false,
          error: 'Price not initialized yet. Please try again in a few moments.'
        };
      }

      console.log(`Using price ID: ${priceId}`);

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

      const baseUrl = process.env.APP_URL || 'http://localhost:3000';

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
        success_url: `${baseUrl}/subscription-management?session_id={CHECKOUT_SESSION_ID}&success=true`,
        cancel_url: `${baseUrl}/pricing?canceled=true`,
        allow_promotion_codes: true,
        billing_address_collection: 'required',
      });

      console.log('Created checkout session:', session.id);

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
      const baseUrl = process.env.APP_URL || 'http://localhost:3000';
      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${baseUrl}/subscription-management`,
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