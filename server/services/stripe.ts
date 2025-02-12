import Stripe from 'stripe';
import { db } from '../db';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY must be set');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

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
  async getOrCreateCustomer(email: string): Promise<string> {
    try {
      // Create new customer
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
      throw new Error('Failed to process customer information');
    }
  }

  async createCheckoutSession({
    email,
    priceId,
    userId,
    planId,
    successUrl,
    cancelUrl,
    isTrial = false
  }: {
    email: string;
    priceId: string;
    userId: number;
    planId: number;
    successUrl: string;
    cancelUrl: string;
    isTrial?: boolean;
  }) {
    try {
      // Create a new customer for each checkout
      const customer = await this.getOrCreateCustomer(email);

      console.log('Creating checkout session:', {
        customer,
        priceId,
        userId,
        planId,
        isTrial
      });

      const sessionConfig: Stripe.Checkout.SessionCreateParams = {
        customer,
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          }
        ],
        subscription_data: isTrial ? {
          trial_period_days: 1
        } : undefined,
        metadata: {
          userId: userId.toString(),
          planId: planId.toString()
        },
        success_url: successUrl,
        cancel_url: cancelUrl,
        automatic_tax: { enabled: true }
      };

      const session = await stripe.checkout.sessions.create(sessionConfig);

      console.log('Checkout session created:', session.id);
      return session;
    } catch (error) {
      console.error('Error creating checkout session:', error);
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