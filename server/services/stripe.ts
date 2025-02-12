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

      // Create Checkout Session for subscription
      const session = await stripe.checkout.sessions.create({
        customer: customer.id,
        mode: 'subscription',
        line_items: [{
          price: priceId,
          quantity: 1,
        }],
        success_url: successUrl,
        cancel_url: cancelUrl,
        client_reference_id: userId.toString(),
        metadata: {
          userId: userId.toString(),
          planId: planId.toString(),
        },
      });

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
}

export const stripeService = new StripeService();