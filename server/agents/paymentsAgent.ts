import { stripe, stripeService, SUBSCRIPTION_PLANS } from '../services/stripe';
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

      const plan = await db.query.subscriptionPlans.findFirst({
        where: eq(subscriptionPlans.id, planId)
      });

      if (!plan) {
        return { isValid: false, error: 'Invalid subscription plan' };
      }

      // Verify student status if needed
      if (plan.isStudent) {
        const isValidStudent = await stripeService.verifyStudentEmail(user.email);
        if (!isValidStudent) {
          return { isValid: false, error: 'Invalid student email. Must be a .edu email address' };
        }
      }

      // Check if user already has an active subscription
      const existingSubscription = await db.query.subscriptions.findFirst({
        where: eq(subscriptions.userId, user.id)
      });

      if (existingSubscription && !existingSubscription.cancelAtPeriodEnd) {
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
      const validation = await this.validateUserForSubscription(user, planId);
      if (!validation.isValid) {
        return { success: false, error: validation.error };
      }

      const plan = await db.query.subscriptionPlans.findFirst({
        where: eq(subscriptionPlans.id, planId)
      });

      if (!plan) {
        return { success: false, error: 'Plan not found' };
      }

      // Create or get customer
      const customerId = await stripeService.getOrCreateCustomer(
        user.email,
        user.stripeCustomerId,
        user.name
      );

      // Create checkout session
      const session = await stripeService.createCheckoutSession({
        customerId,
        priceId: interval === 'year' ? plan.stripePriceIdYearly : plan.stripePriceIdMonthly,
        userId: user.id,
        planId: plan.id,
        isTrial: plan.isStudent,
        successUrl: `${process.env.APP_URL}/subscription-management?success=true`,
        cancelUrl: `${process.env.APP_URL}/subscription?canceled=true`
      });

      return { success: true, sessionId: session.id };
    } catch (error) {
      console.error('Payment initialization error:', error);
      return { success: false, error: 'Failed to initialize payment' };
    }
  }

  async cancelSubscription(user: User): Promise<{ 
    success: boolean; 
    error?: string; 
  }> {
    try {
      const subscription = await db.query.subscriptions.findFirst({
        where: eq(subscriptions.userId, user.id)
      });

      if (!subscription) {
        return { success: false, error: 'No active subscription found' };
      }

      await stripeService.cancelSubscription(subscription.stripeSubscriptionId);

      await db
        .update(subscriptions)
        .set({ cancelAtPeriodEnd: true })
        .where(eq(subscriptions.id, subscription.id));

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
      const subscription = await db.query.subscriptions.findFirst({
        where: eq(subscriptions.userId, user.id)
      });

      if (!subscription) {
        return { success: true, invoices: [] };
      }

      const invoices = await stripeService.getBillingHistory(subscription.stripeCustomerId);
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
      const subscription = await db.query.subscriptions.findFirst({
        where: eq(subscriptions.userId, user.id),
        with: {
          plan: true
        }
      });

      if (!subscription) {
        return { success: true, subscription: null };
      }

      const stripeSubscription = await stripeService.getSubscriptionDetails(
        subscription.stripeSubscriptionId
      );

      return { 
        success: true, 
        subscription: {
          ...subscription,
          stripeSubscription
        }
      };
    } catch (error) {
      console.error('Subscription status error:', error);
      return { success: false, error: 'Failed to fetch subscription status' };
    }
  }
}

// Export singleton instance
export const paymentsAgent = new PaymentsAgent();
