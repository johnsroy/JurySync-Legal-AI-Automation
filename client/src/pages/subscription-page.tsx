import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CreditCard } from 'lucide-react';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';

export default function SubscriptionPage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [location] = useLocation();
  const { user } = useAuth();

  // Extract plan ID and status from URL
  const params = new URLSearchParams(window.location.search);
  const planId = params.get('plan');
  const success = params.get('success');
  const canceled = params.get('canceled');
  const sessionId = params.get('session_id');

  useEffect(() => {
    if (success && sessionId) {
      toast({
        title: 'Success!',
        description: 'Your payment method has been authorized. Your free trial starts now!',
      });
    } else if (canceled) {
      toast({
        title: 'Checkout canceled',
        description: 'You have not been charged.',
        variant: 'destructive',
      });
    }
  }, [success, canceled, sessionId, toast]);

  const handleCheckout = async () => {
    try {
      if (!user) {
        toast({
          title: 'Authentication Required',
          description: 'Please sign in to continue.',
          variant: 'destructive',
        });
        return;
      }

      setIsLoading(true);
      console.log('Initiating checkout...', { planId });

      const response = await fetch('/api/payments/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planId: parseInt(planId || '1'),
          interval: 'month',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create checkout session');
      }

      const { url } = await response.json();
      if (!url) throw new Error('No checkout URL received');

      // Redirect to Stripe Checkout
      window.location.href = url;
    } catch (error) {
      console.error('Checkout error:', error);
      toast({
        title: 'Payment Error',
        description: error instanceof Error ? error.message : 'Failed to initialize payment',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-md mx-auto">
        <Card className="shadow-lg">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">Student Plan</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="text-center">
                <p className="text-3xl font-bold">$24</p>
                <p className="text-sm text-gray-500">per month</p>
              </div>

              <div className="space-y-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-medium text-blue-900">Secure Payment with Stripe</h4>
                  <p className="text-sm text-blue-700">
                    Your payment information will be securely stored for future billing.
                  </p>
                </div>

                <div className="bg-green-50 p-4 rounded-lg">
                  <h4 className="font-medium text-green-900">Free Trial Included</h4>
                  <p className="text-sm text-green-700">
                    After authorizing your payment method, enjoy 1 day of free access.
                  </p>
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
                    Start Your Free Trial
                  </>
                )}
              </Button>

              <p className="text-sm text-gray-500 text-center">
                Secure payment powered by Stripe
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}