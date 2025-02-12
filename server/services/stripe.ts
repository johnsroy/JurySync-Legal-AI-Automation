import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY must be set');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16'
});

// Student plan: $24/month
const STUDENT_MONTHLY_PRICE = 'price_1OiXXXXXXXXXXXXXXXXXXXXX'; // Replace with your actual price ID
// Professional plan: $194/month
const PROFESSIONAL_MONTHLY_PRICE = 'price_2OiXXXXXXXXXXXXXXXXXXXXX'; // Replace with your actual price ID

export class StripeService {
  async createCheckoutSession({
    priceId = STUDENT_MONTHLY_PRICE, // Default to student monthly plan
    successUrl,
    cancelUrl,
  }: {
    priceId?: string;
    successUrl: string;
    cancelUrl: string;
  }) {
    try {
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        line_items: [{
          price: priceId,
          quantity: 1,
        }],
        success_url: successUrl,
        cancel_url: cancelUrl,
        payment_method_types: ['card'],
      });

      return session;
    } catch (error) {
      console.error('Error creating checkout session:', error);
      throw error;
    }
  }

  async verifyStudentEmail(email: string): Promise<boolean> {
    return email.toLowerCase().endsWith('.edu');
  }
}

export const stripeService = new StripeService();