import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CreditCard } from 'lucide-react';
import { useLocation } from 'wouter';

export default function SubscriptionPage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [location] = useLocation();

  // Extract plan ID from URL using URLSearchParams
  const params = new URLSearchParams(window.location.search);
  const planId = params.get('plan');
  const success = params.get('success');
  const canceled = params.get('canceled');

  const handleCheckout = async () => {
    try {
      setIsLoading(true);
      console.log('Initiating checkout...', { planId });

      const response = await fetch('/api/payments/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planId: parseInt(planId || '1'), // Default to first plan if not specified
          interval: 'month', // Default to monthly
        }),
      });

      console.log('Checkout response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create checkout session');
      }

      const { url } = await response.json();
      console.log('Redirecting to:', url);

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

  // Handle success/failure redirects
  if (success) {
    toast({
      title: 'Success!',
      description: 'Your subscription has been activated.',
    });
  } else if (canceled) {
    toast({
      title: 'Checkout canceled',
      description: 'You have not been charged.',
      variant: 'destructive',
    });
  }

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
                Includes 1-day free trial
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}