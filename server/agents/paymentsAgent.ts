import { stripe, stripeService } from '../services/stripe';
import { db } from '../db';
import { eq } from 'drizzle-orm';
import { subscriptions, subscriptionPlans, type Subscription, type SubscriptionPlan } from '@shared/schema/subscriptions';
import type { User } from '@shared/schema';
import Stripe from 'stripe';

// Type definitions for PaymentsAgent responses
interface ValidationResult {
  isValid: boolean;
  error?: string;
}

interface CheckoutResult {
  success: boolean;
  sessionId?: string;
  error?: string;
}

interface CancellationResult {
  success: boolean;
  error?: string;
}

interface SubscriptionStatusResult {
  success: boolean;
  subscription?: {
    id: number;
    userId: number;
    planId: number;
    stripeCustomerId: string;
    stripeSubscriptionId: string;
    status: string;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    cancelAtPeriodEnd: boolean;
    createdAt: Date;
    plan: SubscriptionPlan;
    stripeSubscription: Stripe.Subscription;
  } | null;
  error?: string;
}

export class PaymentsAgent {
  constructor() {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY must be set');
    }
  }

  async validateUserForSubscription(user: User, planId: number): Promise<ValidationResult> {
    try {
      if (!user) {
        return { isValid: false, error: 'User not authenticated' };
      }

      const plan = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, planId)).limit(1);

      if (!plan || plan.length === 0) {
        return { isValid: false, error: 'Invalid subscription plan' };
      }

      // Verify student status if needed
      if (plan[0].isStudent) {
        const isValidStudent = await stripeService.verifyStudentEmail(user.email);
        if (!isValidStudent) {
          return { isValid: false, error: 'Invalid student email. Must be a .edu email address' };
        }
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

  async initializeCheckout(user: User, planId: number, interval: 'month' | 'year'): Promise<CheckoutResult> {
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

      // Get the correct price ID based on interval
      const priceId = interval === 'year' ? selectedPlan.stripePriceIdYearly : selectedPlan.stripePriceIdMonthly;
      if (!priceId) {
        return { success: false, error: 'Invalid price configuration' };
      }

      // Create checkout session
      const session = await stripeService.createCheckoutSession({
        email: user.email,
        priceId,
        userId: user.id,
        planId: selectedPlan.id,
        isTrial: selectedPlan.isStudent,
        successUrl: `${process.env.APP_URL}/subscription?success=true`,
        cancelUrl: `${process.env.APP_URL}/subscription?canceled=true`
      });

      return { success: true, sessionId: session.id };
    } catch (error) {
      console.error('Payment initialization error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to initialize payment' };
    }
  }

  async cancelSubscription(user: User): Promise<CancellationResult> {
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

  async getSubscriptionStatus(user: User): Promise<SubscriptionStatusResult> {
    try {
      const subscriptionResult = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.userId, user.id))
        .limit(1);

      if (!subscriptionResult || subscriptionResult.length === 0) {
        return { success: true, subscription: null };
      }

      const subscription = subscriptionResult[0];

      // Get plan details
      const planResult = await db
        .select()
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.id, subscription.planId))
        .limit(1);

      if (!planResult || planResult.length === 0) {
        return { success: false, error: 'Subscription plan not found' };
      }

      const plan = planResult[0];

      // Get Stripe subscription details
      let stripeSubscription: Stripe.Subscription;
      try {
        stripeSubscription = await stripe.subscriptions.retrieve(
          subscription.stripeSubscriptionId
        );
      } catch (stripeError) {
        console.error('Failed to retrieve Stripe subscription:', stripeError);
        // Return local data even if Stripe fails
        return {
          success: true,
          subscription: {
            ...subscription,
            plan,
            stripeSubscription: null as unknown as Stripe.Subscription
          }
        };
      }

      return {
        success: true,
        subscription: {
          ...subscription,
          plan,
          stripeSubscription
        }
      };
    } catch (error) {
      console.error('Subscription status error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to fetch subscription status' };
    }
  }

  /**
   * Reactivate a canceled subscription before it expires
   */
  async reactivateSubscription(user: User): Promise<CancellationResult> {
    try {
      const subscriptionResult = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.userId, user.id))
        .limit(1);

      if (!subscriptionResult || subscriptionResult.length === 0) {
        return { success: false, error: 'No subscription found' };
      }

      const subscription = subscriptionResult[0];

      if (!subscription.cancelAtPeriodEnd) {
        return { success: false, error: 'Subscription is not scheduled for cancellation' };
      }

      // Reactivate in Stripe
      await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
        cancel_at_period_end: false
      });

      // Update local database
      await db
        .update(subscriptions)
        .set({ cancelAtPeriodEnd: false })
        .where(eq(subscriptions.id, subscription.id));

      return { success: true };
    } catch (error) {
      console.error('Reactivation error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to reactivate subscription' };
    }
  }
}

export const paymentsAgent = new PaymentsAgent();