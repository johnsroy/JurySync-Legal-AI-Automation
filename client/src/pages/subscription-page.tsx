import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CreditCard, Shield } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useLocation } from 'wouter';
import { apiRequest } from '@/lib/queryClient';
import { PRICING_PLANS } from '@shared/schema/pricing';

export default function SubscriptionPage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  // Extract URL parameters
  const params = new URLSearchParams(window.location.search);
  const success = params.get('success');
  const canceled = params.get('canceled');
  const planId = params.get('plan');

  useEffect(() => {
    if (success) {
      toast({
        title: 'Success!',
        description: 'Your subscription has been activated. Enjoy your premium access!',
      });
      setLocation('/dashboard');
    } else if (canceled) {
      toast({
        title: 'Checkout canceled',
        description: 'You have not been charged.',
        variant: 'destructive',
      });
    }
  }, [success, canceled, toast, setLocation]);

  const handleCheckout = async () => {
    try {
      if (!user) {
        toast({
          title: 'Authentication Required',
          description: 'Please sign in to continue.',
          variant: 'destructive',
        });
        setLocation('/login');
        return;
      }

      if (!planId) {
        toast({
          title: 'Invalid Plan',
          description: 'Please select a valid subscription plan.',
          variant: 'destructive',
        });
        return;
      }

      const selectedPlan = PRICING_PLANS.find(p => p.id === planId);
      if (!selectedPlan || !selectedPlan.priceId) {
        toast({
          title: 'Invalid Plan',
          description: 'Please select a valid subscription plan.',
          variant: 'destructive',
        });
        return;
      }

      setIsLoading(true);

      const response = await apiRequest('POST', '/api/payments/create-payment-link', {
        priceId: selectedPlan.priceId,
      });

      if (!response.ok) {
        throw new Error('Failed to create payment link');
      }

      const data = await response.json();

      if (!data.url) {
        throw new Error('No payment URL received from server');
      }

      // Redirect to Stripe Payment Link
      window.location.href = data.url;
    } catch (error) {
      console.error('Checkout error:', error);
      toast({
        title: 'Checkout Error',
        description: error instanceof Error ? error.message : 'Failed to start checkout process',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!planId) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto">
          <Card>
            <CardContent className="py-8">
              <div className="text-center">
                <h3 className="text-lg font-medium mb-2">No Plan Selected</h3>
                <p className="text-muted-foreground mb-6">
                  Please select a subscription plan to continue.
                </p>
                <Button asChild>
                  <a href="/pricing">View Plans</a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const selectedPlan = PRICING_PLANS.find(p => p.id === planId);
  if (!selectedPlan) {
    setLocation('/pricing');
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-md mx-auto">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Complete Your Subscription</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="bg-blue-50 p-4 rounded-lg flex items-start space-x-3">
                  <Shield className="h-5 w-5 text-blue-500 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-blue-900">Secure Payment with Stripe</h4>
                    <p className="text-sm text-blue-700">
                      Your payment information will be processed securely via Stripe.
                    </p>
                  </div>
                </div>

                <div className="bg-green-50 p-4 rounded-lg flex items-start space-x-3">
                  <CreditCard className="h-5 w-5 text-green-500 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-green-900">Free Trial Included</h4>
                    <p className="text-sm text-green-700">
                      Start with a 1-day free trial. Cancel anytime.
                    </p>
                  </div>
                </div>
              </div>

              <Button 
                className="w-full"
                size="lg"
                onClick={handleCheckout}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CreditCard className="mr-2 h-5 w-5" />
                    Start Free Trial
                  </>
                )}
              </Button>

              <p className="text-sm text-muted-foreground text-center">
                Secure payment powered by Stripe
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}