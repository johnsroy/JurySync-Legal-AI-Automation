import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY must be set');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-01-27.acacia',
  typescript: true,
});

export class StripeService {
  async createPaymentLink(priceId: string): Promise<{ 
    success: boolean;
    url?: string;
    error?: string;
  }> {
    try {
      const paymentLink = await stripe.paymentLinks.create({
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        after_completion: { 
          type: 'redirect',
          redirect: { url: `${process.env.APP_URL}/subscription?success=true` }
        },
        metadata: {
          priceId: priceId
        }
      });

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