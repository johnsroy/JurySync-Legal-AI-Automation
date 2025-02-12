import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY must be set');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

export class StripeService {
  async createCheckoutSession({
    email,
    priceId,
    userId,
    planId,
    successUrl,
    cancelUrl,
  }: {
    email: string;
    priceId: string;
    userId: number;
    planId: number;
    successUrl: string;
    cancelUrl: string;
  }) {
    try {
      // Create a customer if they don't exist
      const customer = await this.getOrCreateCustomer(email);

      // Set up the subscription parameters with Link payment and trial period
      const subscriptionData: Stripe.Checkout.SessionCreateParams = {
        customer: customer.id,
        mode: 'subscription',
        payment_method_types: ['card', 'link'],
        payment_method_collection: 'always',
        line_items: [{
          price: priceId,
          quantity: 1,
        }],
        success_url: successUrl,
        cancel_url: cancelUrl,
        subscription_data: {
          trial_period_days: 1, // 1-day trial after payment method is authorized
          metadata: {
            userId: userId.toString(),
            planId: planId.toString(),
          },
        },
        metadata: {
          userId: userId.toString(),
          planId: planId.toString(),
        },
        allow_promotion_codes: true,
        billing_address_collection: 'required',
        client_reference_id: userId.toString(),
        consent_collection: {
          terms_of_service: 'required',
        },
        automatic_tax: {
          enabled: true,
        }
      };

      const session = await stripe.checkout.sessions.create(subscriptionData);
      return { success: true, session };
    } catch (error) {
      console.error('Error creating checkout session:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to create checkout session' 
      };
    }
  }

  private async getOrCreateCustomer(email: string): Promise<Stripe.Customer> {
    const existingCustomers = await stripe.customers.list({
      email: email,
      limit: 1,
    });

    if (existingCustomers.data.length > 0) {
      return existingCustomers.data[0];
    }

    return await stripe.customers.create({
      email: email,
    });
  }

  async verifyStudentEmail(email: string): Promise<boolean> {
    return email.toLowerCase().endsWith('.edu');
  }
}

export const stripeService = new StripeService();