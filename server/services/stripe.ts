import Stripe from 'stripe';
import { db } from '../db';
import { subscriptionPlans, subscriptions } from '@shared/schema/subscriptions';
import { eq } from 'drizzle-orm';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

export const SUBSCRIPTION_PLANS = {
  STUDENT: {
    name: 'Student',
    priceMonthly: 24,
    priceYearly: 240, // 2 months free
    features: [
      'Basic document analysis',
      'Standard templates',
      'Email support',
      'Limited API access'
    ],
    trial_days: 1
  },
  PROFESSIONAL: {
    name: 'Professional',
    priceMonthly: 194,
    priceYearly: 1940, // 2 months free
    features: [
      'Advanced document analysis',
      'Custom templates',
      'Priority support',
      'Full API access',
      'Team collaboration'
    ]
  },
  ENTERPRISE: {
    name: 'Enterprise',
    priceMonthly: null, // Custom pricing
    priceYearly: null,
    features: [
      'Custom document workflows',
      'Dedicated support',
      'Advanced security features',
      'Custom integrations',
      'Volume discounts'
    ]
  }
} as const;

export class StripeService {
  // Create or retrieve a Stripe customer
  async createOrRetrieveCustomer(userId: number, email: string, name?: string): Promise<string> {
    try {
      // Check if customer already exists in our database
      const existingSubscription = await db.query.subscriptions.findFirst({
        where: eq(subscriptions.userId, userId)
      });

      if (existingSubscription?.stripeCustomerId) {
        return existingSubscription.stripeCustomerId;
      }

      // Create new customer in Stripe
      const customer = await stripe.customers.create({
        email,
        name,
        metadata: {
          userId: userId.toString()
        }
      });

      return customer.id;
    } catch (error) {
      console.error('Error in createOrRetrieveCustomer:', error);
      throw new Error('Failed to create or retrieve customer');
    }
  }

  // Create a checkout session
  async createCheckoutSession({
    customerId,
    priceId,
    userId,
    planId,
    isTrial = false,
    successUrl,
    cancelUrl
  }: {
    customerId: string;
    priceId: string;
    userId: number;
    planId: number;
    isTrial?: boolean;
    successUrl: string;
    cancelUrl: string;
  }) {
    try {
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        subscription_data: {
          trial_period_days: isTrial ? SUBSCRIPTION_PLANS.STUDENT.trial_days : undefined,
        },
        success_url: successUrl,
        cancel_url: cancelUrl,
      });

      return session;
    } catch (error) {
      console.error('Error creating checkout session:', error);
      throw error;
    }
  }

  // Update subscription
  async updateSubscription(subscriptionId: string, priceId: string) {
    try {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);

      return await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: false,
        proration_behavior: 'create_prorations',
        items: [{
          id: subscription.items.data[0].id,
          price: priceId,
        }],
      });
    } catch (error) {
      console.error('Error in updateSubscription:', error);
      throw new Error('Failed to update subscription');
    }
  }

  // Cancel subscription
  async cancelSubscription(subscriptionId: string) {
    try {
      return await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true
      });
    } catch (error) {
      console.error('Error in cancelSubscription:', error);
      throw new Error('Failed to cancel subscription');
    }
  }

  // Verify student email
  async verifyStudentEmail(email: string): Promise<boolean> {
    return email.toLowerCase().endsWith('.edu');
  }

  // Get subscription details
  async getSubscriptionDetails(subscriptionId: string) {
    try {
      return await stripe.subscriptions.retrieve(subscriptionId, {
        expand: ['customer', 'default_payment_method']
      });
    } catch (error) {
      console.error('Error in getSubscriptionDetails:', error);
      throw new Error('Failed to get subscription details');
    }
  }

  // Get customer payment methods
  async getCustomerPaymentMethods(customerId: string) {
    try {
      return await stripe.paymentMethods.list({
        customer: customerId,
        type: 'card'
      });
    } catch (error) {
      console.error('Error in getCustomerPaymentMethods:', error);
      throw new Error('Failed to get payment methods');
    }
  }
}

export const stripeService = new StripeService();