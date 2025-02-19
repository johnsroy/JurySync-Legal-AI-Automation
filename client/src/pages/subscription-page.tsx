import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { loadStripe } from "stripe";

export default function SubscriptionPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  useEffect(() => {
    // Get plan from URL
    const params = new URLSearchParams(window.location.search);
    const plan = params.get('plan');
    if (plan) {
      setSelectedPlan(plan);
    }
  }, []);

  const handleSubscribe = async () => {
    if (!user) {
      setLocation('/login');
      return;
    }

    try {
      setIsLoading(true);

      // Create checkout session
      const response = await fetch('/api/subscription/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          priceId: selectedPlan === '1' ? 'BASIC_PRICE_ID' : 'PRO_PRICE_ID'
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create checkout session');
      }

      const { sessionId } = await response.json();

      // Redirect to Stripe Checkout
      const stripe = await loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);
      if (!stripe) {
        throw new Error('Stripe failed to load');
      }

      const { error } = await stripe.redirectToCheckout({ sessionId });
      if (error) {
        throw error;
      }

    } catch (error) {
      console.error('Subscription error:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to start subscription',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartTrial = async () => {
    if (!user) {
      setLocation('/login');
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch('/api/subscription/trial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error('Failed to start trial');
      }

      toast({
        title: 'Success',
        description: 'Your free trial has started!',
      });
      setLocation('/dashboard');

    } catch (error) {
      console.error('Trial error:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to start trial',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800 p-4">
      <Card className="w-full max-w-md p-8 text-center space-y-6 bg-background/95 backdrop-blur-lg shadow-xl border-border">
        <h1 className="text-2xl font-bold text-white">Complete Your Subscription</h1>

        <div className="space-y-4">
          <div className="bg-blue-100 text-blue-800 p-4 rounded">
            <h2 className="font-semibold">Secure Payment with Stripe</h2>
            <p className="text-sm">Your payment information will be processed securely via Stripe.</p>
          </div>

          <div className="bg-green-100 text-green-800 p-4 rounded">
            <h2 className="font-semibold">Free Trial Included</h2>
            <p className="text-sm">Start with a 1-day free trial. Cancel anytime.</p>
          </div>
        </div>

        <div className="space-y-4">
          <Button
            onClick={handleStartTrial}
            className="w-full h-12"
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Start Free Trial
          </Button>

          <Button
            onClick={handleSubscribe}
            variant="outline"
            className="w-full h-12"
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Continue to Payment
          </Button>
        </div>

        <p className="text-sm text-gray-400">
          Secure payment powered by Stripe
        </p>
      </Card>
    </div>
  );
}