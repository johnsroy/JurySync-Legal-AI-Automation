import { stripe, stripeService } from '../services/stripe';
import { db } from '../db';
import { eq } from 'drizzle-orm';
import { subscriptions, subscriptionPlans } from '@shared/schema/subscriptions';
import type { User } from '@shared/schema';

export class PaymentsAgent {
  constructor() {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY must be set');
    }
  }

  async validateUserForSubscription(user: User, planId: number): Promise<{ 
    isValid: boolean; 
    error?: string; 
  }> {
    try {
      if (!user) {
        return { isValid: false, error: 'User not authenticated' };
      }

      const plan = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, planId)).limit(1);

      if (!plan || plan.length === 0) {
        return { isValid: false, error: 'Invalid subscription plan' };
      }

      // Check if user already has an active subscription
      const existingSubscription = await db.select().from(subscriptions)
        .where(eq(subscriptions.userId, user.id))
        .limit(1);

      if (existingSubscription && existingSubscription.length > 0 && !existingSubscription[0].cancelAtPeriodEnd) {
        return { isValid: false, error: 'User already has an active subscription' };
      }

      return { isValid: true };
    } catch (error) {
      console.error('Validation error:', error);
      return { isValid: false, error: 'Failed to validate subscription requirements' };
    }
  }

  async initializePaymentLink(user: User, planId: number): Promise<{ 
    success: boolean; 
    url?: string; 
    error?: string; 
  }> {
    try {
      const validation = await this.validateUserForSubscription(user, planId);
      if (!validation.isValid) {
        return { success: false, error: validation.error };
      }

      // Get the plan details
      const plan = await db.select().from(subscriptionPlans)
        .where(eq(subscriptionPlans.id, planId))
        .limit(1);

      if (!plan || plan.length === 0) {
        return { success: false, error: 'Invalid subscription plan' };
      }

      const selectedPlan = plan[0];
      const priceId = selectedPlan.stripePriceIdMonthly;

      if (!priceId) {
        return { success: false, error: 'Invalid price configuration' };
      }

      // Create payment link
      const result = await stripeService.createPaymentLink({
        priceId,
        userId: user.id,
        planId: selectedPlan.id,
        successUrl: `${process.env.APP_URL}/subscription?success=true`,
        cancelUrl: `${process.env.APP_URL}/subscription?canceled=true`
      });

      return { 
        success: result.success, 
        url: result.url,
        error: result.error
      };
    } catch (error) {
      console.error('Payment initialization error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to initialize payment' };
    }
  }

  async getSubscriptionStatus(user: User): Promise<{
    success: boolean;
    subscription?: any;
    error?: string;
  }> {
    try {
      const subscription = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.userId, user.id))
        .limit(1);

      if (!subscription || subscription.length === 0) {
        return { success: true, subscription: null };
      }

      // Get plan details
      const plan = await db
        .select()
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.id, subscription[0].planId))
        .limit(1);

      const stripeSubscription = await stripe.subscriptions.retrieve(
        subscription[0].stripeSubscriptionId
      );

      return { 
        success: true, 
        subscription: {
          ...subscription[0],
          plan: plan[0],
          stripeSubscription
        }
      };
    } catch (error) {
      console.error('Subscription status error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to fetch subscription status' };
    }
  }

  async cancelSubscription(user: User): Promise<{ 
    success: boolean; 
    error?: string; 
  }> {
    try {
      const subscription = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.userId, user.id))
        .limit(1);

      if (!subscription || subscription.length === 0) {
        return { success: false, error: 'No active subscription found' };
      }

      // Cancel the subscription in Stripe
      await stripe.subscriptions.update(subscription[0].stripeSubscriptionId, {
        cancel_at_period_end: true
      });

      // Update local database
      await db
        .update(subscriptions)
        .set({ cancelAtPeriodEnd: true })
        .where(eq(subscriptions.id, subscription[0].id));

      return { success: true };
    } catch (error) {
      console.error('Cancellation error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to cancel subscription' };
    }
  }
}

export const paymentsAgent = new PaymentsAgent();