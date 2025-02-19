import Stripe from 'stripe';
import { db } from '../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_51QphA7H4iREzwvJFnuDViWhHTHSyIRpqI2FqB1OLLD6t0PTo1vSykzWArMpNgzmtO8HNMrGjn0gtuhrffZXGvybn00S7Qi6h8N', {
  apiVersion: '2023-10-16',
});

export const stripeService = {
  async createCheckoutSession(userId: number, priceId: string) {
    try {
      // Get user
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId));

      if (!user) {
        throw new Error('User not found');
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
        success_url: `${process.env.CLIENT_URL}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.CLIENT_URL}/subscription/cancel`,
        subscription_data: {
          trial_period_days: 1, // 1-day free trial
        },
        allow_promotion_codes: true,
        billing_address_collection: 'required',
      });

      return session;
    } catch (error) {
      console.error('Stripe checkout error:', error);
      throw error;
    }
  },

  async createTrialSubscription(userId: number) {
    try {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId));

      if (!user) {
        throw new Error('User not found');
      }

      // Update user with trial status
      await db
        .update(users)
        .set({
          subscriptionStatus: 'TRIAL',
          subscriptionEndsAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1 day trial
          trialUsed: true
        })
        .where(eq(users.id, userId));

      return true;
    } catch (error) {
      console.error('Trial creation error:', error);
      throw error;
    }
  }
}; 