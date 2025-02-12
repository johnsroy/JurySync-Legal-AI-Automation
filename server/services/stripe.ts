import Stripe from 'stripe';
import { db } from '../db';
import { subscriptions } from '@shared/schema/subscriptions';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY must be set');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16'
});

export const SUBSCRIPTION_PLANS = {
  STUDENT: {
    name: 'Student',
    description: 'Perfect for law students and academic research',
    priceMonthly: 24,
    priceYearly: 240,
    trial_days: 1,
    features: [
      'Access to basic legal research tools',
      'Document analysis',
      'Basic AI assistance',
      'Student community access'
    ]
  },
  PROFESSIONAL: {
    name: 'Professional',
    description: 'Ideal for legal professionals and small firms',
    priceMonthly: 194,
    priceYearly: 1940,
    features: [
      'Advanced legal research tools',
      'Priority AI processing',
      'Custom document templates',
      'Advanced analytics',
      'Priority support'
    ]
  },
  ENTERPRISE: {
    name: 'Enterprise',
    description: 'Custom solutions for large organizations',
    priceMonthly: null,
    priceYearly: null,
    features: [
      'Custom AI model training',
      'Dedicated account manager',
      'Custom integrations',
      'Advanced security features',
      'SLA guarantees',
      'On-premise deployment options'
    ]
  }
};

export class StripeService {
  // Create or retrieve a customer
  async getOrCreateCustomer(
    email: string,
    stripeCustomerId?: string | null,
    name?: string
  ): Promise<string> {
    if (stripeCustomerId) {
      return stripeCustomerId;
    }

    const customer = await stripe.customers.create({
      email,
      name,
      metadata: {
        createdAt: new Date().toISOString()
      }
    });

    return customer.id;
  }

  // Create a checkout session for subscription
  async createCheckoutSession({
    customerId,
    priceId,
    userId,
    planId,
    successUrl,
    cancelUrl,
    isTrial = false
  }: {
    customerId: string;
    priceId: string;
    userId: number;
    planId: number;
    successUrl: string;
    cancelUrl: string;
    isTrial?: boolean;
  }) {
    try {
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1
          }
        ],
        mode: 'subscription',
        subscription_data: {
          trial_period_days: isTrial ? SUBSCRIPTION_PLANS.STUDENT.trial_days : undefined
        },
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          userId: userId.toString(),
          planId: planId.toString()
        }
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
          price: priceId
        }]
      });
    } catch (error) {
      console.error('Error updating subscription:', error);
      throw error;
    }
  }

  // Cancel subscription
  async cancelSubscription(subscriptionId: string) {
    try {
      return await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true
      });
    } catch (error) {
      console.error('Error canceling subscription:', error);
      throw error;
    }
  }

  // Get subscription details
  async getSubscriptionDetails(subscriptionId: string) {
    try {
      return await stripe.subscriptions.retrieve(subscriptionId);
    } catch (error) {
      console.error('Error retrieving subscription:', error);
      throw error;
    }
  }

  // Verify student email
  async verifyStudentEmail(email: string): Promise<boolean> {
    return email.toLowerCase().endsWith('.edu');
  }

  // Get billing history
  async getBillingHistory(customerId: string) {
    try {
      const invoices = await stripe.invoices.list({
        customer: customerId,
        limit: 24
      });
      return invoices.data;
    } catch (error) {
      console.error('Error retrieving billing history:', error);
      throw error;
    }
  }
}

export const stripeService = new StripeService();