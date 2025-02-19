import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY must be set');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
  typescript: true,
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
      console.log('Creating checkout session...', { email, priceId, userId, planId });

      // Create a customer if they don't exist
      const customer = await this.getOrCreateCustomer(email);
      console.log('Customer retrieved/created:', customer.id);

      // Create Checkout Session for subscription
      const session = await stripe.checkout.sessions.create({
        customer: customer.id,
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [{
          price: priceId,
          quantity: 1,
        }],
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          userId: userId.toString(),
          planId: planId.toString(),
        },
      });

      console.log('Checkout session created:', session.id);
      return { success: true, url: session.url };
    } catch (error) {
      console.error('Error creating checkout session:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to create checkout session' 
      };
    }
  }

  private async getOrCreateCustomer(email: string): Promise<Stripe.Customer> {
    try {
      const existingCustomers = await stripe.customers.list({
        email: email,
        limit: 1,
      });

      if (existingCustomers.data.length > 0) {
        console.log('Found existing customer:', existingCustomers.data[0].id);
        return existingCustomers.data[0];
      }

      const newCustomer = await stripe.customers.create({
        email: email,
      });
      console.log('Created new customer:', newCustomer.id);
      return newCustomer;
    } catch (error) {
      console.error('Error in getOrCreateCustomer:', error);
      throw error;
    }
  }
}

export const stripeService = new StripeService();