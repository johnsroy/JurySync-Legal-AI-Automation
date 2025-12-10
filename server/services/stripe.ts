import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY must be set');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
  typescript: true,
});

export interface CheckoutSessionParams {
  email: string;
  priceId: string;
  userId: number;
  planId: number;
  isTrial?: boolean;
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutSessionResult {
  success: boolean;
  id?: string;
  url?: string | null;
  error?: string;
}

export class StripeService {
  /**
   * Verifies if an email is a valid student email (ends with .edu or other educational domains)
   */
  async verifyStudentEmail(email: string): Promise<boolean> {
    if (!email) return false;

    // Check if email ends with common educational domains
    const educationalDomains = ['.edu', '.edu.au', '.ac.uk', '.edu.cn', '.edu.in'];
    const lowercaseEmail = email.toLowerCase();
    return educationalDomains.some(domain => lowercaseEmail.endsWith(domain));
  }

  async createCheckoutSession({
    email,
    priceId,
    userId,
    planId,
    isTrial = false,
    successUrl,
    cancelUrl,
  }: CheckoutSessionParams): Promise<CheckoutSessionResult> {
    try {
      console.log('Creating checkout session...', { email, priceId, userId, planId, isTrial });

      // Create a customer if they don't exist
      const customer = await this.getOrCreateCustomer(email);
      console.log('Customer retrieved/created:', customer.id);

      // Create Checkout Session for subscription
      const sessionConfig: Stripe.Checkout.SessionCreateParams = {
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
      };

      // Add trial period for student plans
      if (isTrial) {
        sessionConfig.subscription_data = {
          trial_period_days: 14,
        };
      }

      const session = await stripe.checkout.sessions.create(sessionConfig);

      console.log('Checkout session created:', session.id);
      return { success: true, id: session.id, url: session.url };
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
