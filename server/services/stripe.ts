import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY must be set');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-01-27.acacia',
  typescript: true,
});

export class StripeService {
  async createPaymentLink({
    priceId,
    userId,
    planId,
    successUrl,
    cancelUrl,
  }: {
    priceId: string;
    userId: number;
    planId: number;
    successUrl: string;
    cancelUrl: string;
  }) {
    try {
      console.log('Creating payment link...', { priceId, userId, planId });

      const paymentLink = await stripe.paymentLinks.create({
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        after_completion: {
          type: 'redirect',
          redirect: { url: successUrl },
        },
        metadata: {
          userId: userId.toString(),
          planId: planId.toString(),
        },
      });

      console.log('Payment link created:', paymentLink.url);
      return { success: true, url: paymentLink.url };
    } catch (error) {
      console.error('Error creating payment link:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to create payment link' 
      };
    }
  }
}

export const stripeService = new StripeService();