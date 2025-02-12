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

  async initializeCheckout(user: User, planId: number, interval: 'month' | 'year'): Promise<{ 
    success: boolean; 
    sessionId?: string; 
    error?: string; 
  }> {
    try {
      // Validate user and subscription requirements
      if (!user) {
        return { success: false, error: 'User not authenticated' };
      }

      // Get the plan details
      const plan = await db.select().from(subscriptionPlans)
        .where(eq(subscriptionPlans.id, planId))
        .limit(1);

      if (!plan || plan.length === 0) {
        return { success: false, error: 'Invalid subscription plan' };
      }

      const selectedPlan = plan[0];

      // Verify student status if needed
      if (selectedPlan.isStudent) {
        const isValidStudent = await stripeService.verifyStudentEmail(user.email);
        if (!isValidStudent) {
          return { success: false, error: 'Invalid student email. Must be a .edu email address' };
        }
      }

      // Check if user already has an active subscription
      const existingSubscription = await db.select().from(subscriptions)
        .where(eq(subscriptions.userId, user.id))
        .limit(1);

      if (existingSubscription && existingSubscription.length > 0 && !existingSubscription[0].cancelAtPeriodEnd) {
        return { success: false, error: 'User already has an active subscription' };
      }

      // Create or get customer
      const customerId = await stripeService.getOrCreateCustomer(
        user.email,
        user.stripeCustomerId
      );

      // Get the correct price ID based on interval
      const priceId = interval === 'year' ? selectedPlan.stripePriceIdYearly : selectedPlan.stripePriceIdMonthly;
      if (!priceId) {
        return { success: false, error: 'Invalid price configuration' };
      }

      // Create checkout session
      const session = await stripeService.createCheckoutSession({
        customerId,
        priceId,
        userId: user.id,
        planId: selectedPlan.id,
        isTrial: selectedPlan.isStudent,
        successUrl: `${process.env.APP_URL}/subscription-management?success=true`,
        cancelUrl: `${process.env.APP_URL}/subscription?canceled=true`
      });

      return { success: true, sessionId: session.id };
    } catch (error) {
      console.error('Payment initialization error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to initialize payment' };
    }
  }

  async cancelSubscription(user: User): Promise<{ 
    success: boolean; 
    error?: string; 
  }> {
    try {
      const subscription = await db.select().from(subscriptions)
        .where(eq(subscriptions.userId, user.id))
        .limit(1);

      if (!subscription || subscription.length === 0) {
        return { success: false, error: 'No active subscription found' };
      }

      await stripeService.cancelSubscription(subscription[0].stripeSubscriptionId);

      await db
        .update(subscriptions)
        .set({ cancelAtPeriodEnd: true })
        .where(eq(subscriptions.id, subscription[0].id));

      return { success: true };
    } catch (error) {
      console.error('Cancellation error:', error);
      return { success: false, error: 'Failed to cancel subscription' };
    }
  }

  async getBillingHistory(user: User): Promise<{ 
    success: boolean; 
    invoices?: any[]; 
    error?: string; 
  }> {
    try {
      const subscription = await db.select().from(subscriptions)
        .where(eq(subscriptions.userId, user.id))
        .limit(1);

      if (!subscription || subscription.length === 0) {
        return { success: true, invoices: [] };
      }

      const invoices = await stripeService.getBillingHistory(subscription[0].stripeCustomerId);
      return { success: true, invoices };
    } catch (error) {
      console.error('Billing history error:', error);
      return { success: false, error: 'Failed to fetch billing history' };
    }
  }

  async getSubscriptionStatus(user: User): Promise<{
    success: boolean;
    subscription?: any;
    error?: string;
  }> {
    try {
      const subscription = await db.select().from(subscriptions)
        .where(eq(subscriptions.userId, user.id))
        .limit(1);

      if (!subscription || subscription.length === 0) {
        return { success: true, subscription: null };
      }

      const stripeSubscription = await stripeService.getSubscriptionDetails(
        subscription[0].stripeSubscriptionId
      );

      return { 
        success: true, 
        subscription: {
          ...subscription[0],
          stripeSubscription
        }
      };
    } catch (error) {
      console.error('Subscription status error:', error);
      return { success: false, error: 'Failed to fetch subscription status' };
    }
  }
}

export const paymentsAgent = new PaymentsAgent();