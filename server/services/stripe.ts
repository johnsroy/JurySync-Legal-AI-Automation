import Stripe from 'stripe';
import { db } from '../db';

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
  async getOrCreateCustomer(
    email: string,
    stripeCustomerId?: string | null
  ): Promise<string> {
    try {
      if (stripeCustomerId) {
        const customer = await stripe.customers.retrieve(stripeCustomerId);
        if (!customer.deleted) {
          return stripeCustomerId;
        }
      }

      console.log('Creating new Stripe customer:', { email });
      const customer = await stripe.customers.create({
        email,
        metadata: {
          createdAt: new Date().toISOString()
        }
      });

      return customer.id;
    } catch (error) {
      console.error('Error in getOrCreateCustomer:', error);
      throw error;
    }
  }

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
      console.log('Creating checkout session:', {
        customerId,
        priceId,
        userId,
        planId,
        isTrial
      });

      const sessionConfig: Stripe.Checkout.SessionCreateParams = {
        mode: 'subscription',
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1
          }
        ],
        subscription_data: isTrial ? {
          trial_period_days: 1 // 1-day trial for student plans
        } : undefined,
        success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: cancelUrl,
        metadata: {
          userId: userId.toString(),
          planId: planId.toString()
        }
      };

      const session = await stripe.checkout.sessions.create(sessionConfig);
      console.log('Checkout session created:', session.id);
      return session;
    } catch (error) {
      console.error('Error creating checkout session:', error);
      throw error;
    }
  }

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

  async getSubscriptionDetails(subscriptionId: string) {
    try {
      return await stripe.subscriptions.retrieve(subscriptionId, {
        expand: ['latest_invoice', 'customer']
      });
    } catch (error) {
      console.error('Error retrieving subscription:', error);
      throw error;
    }
  }

  async verifyStudentEmail(email: string): Promise<boolean> {
    return email.toLowerCase().endsWith('.edu');
  }

  async getBillingHistory(customerId: string) {
    try {
      const invoices = await stripe.invoices.list({
        customer: customerId,
        limit: 24,
        expand: ['data.subscription']
      });
      return invoices.data;
    } catch (error) {
      console.error('Error retrieving billing history:', error);
      throw error;
    }
  }
}

export const stripeService = new StripeService();