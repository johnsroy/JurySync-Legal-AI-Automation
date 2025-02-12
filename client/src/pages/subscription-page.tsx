import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import { Loader2, CheckCircle } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { apiRequest } from '@/lib/queryClient';

// Initialize Stripe
if (!import.meta.env.VITE_STRIPE_PUBLIC_KEY) {
  throw new Error('VITE_STRIPE_PUBLIC_KEY must be set');
}
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

type Plan = {
  id: number;
  name: string;
  description: string;
  priceMonthly: number;
  priceYearly: number;
  features: string[];
  isStudent: boolean;
  isEnterprise: boolean;
};

export default function SubscriptionPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [billingInterval, setBillingInterval] = useState<'month' | 'year'>('month');
  const [isLoading, setIsLoading] = useState(false);
  const [processingPlanId, setProcessingPlanId] = useState<number | null>(null);

  const { data: plans, isLoading: isLoadingPlans } = useQuery({
    queryKey: ['/api/payments/plans'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/payments/plans');
      if (!response.ok) throw new Error('Failed to fetch plans');
      return response.json();
    },
  });

  const handleSubscribe = async (plan: Plan) => {
    try {
      if (!user) {
        toast({
          title: 'Authentication Required',
          description: 'Please sign in to subscribe',
          variant: 'destructive',
        });
        return;
      }

      if (plan.isEnterprise) {
        window.location.href = 'mailto:enterprise@jurysync.io?subject=Enterprise Plan Inquiry';
        return;
      }

      setIsLoading(true);
      setProcessingPlanId(plan.id);

      const stripe = await stripePromise;
      if (!stripe) {
        throw new Error('Stripe failed to initialize');
      }

      // Create checkout session
      const response = await apiRequest('POST', '/api/payments/create-checkout-session', {
        planId: plan.id,
        interval: billingInterval,
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.error || 'Failed to initialize payment');
      }

      const { sessionId } = responseData;
      if (!sessionId) {
        throw new Error('No session ID returned from server');
      }

      // Redirect to Stripe checkout
      const { error: redirectError } = await stripe.redirectToCheckout({ sessionId });
      if (redirectError) {
        throw redirectError;
      }

    } catch (error) {
      console.error('Payment initialization error:', error);
      toast({
        title: 'Payment Error',
        description: error instanceof Error ? error.message : 'Failed to initialize payment',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
      setProcessingPlanId(null);
    }
  };

  if (isLoadingPlans) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold">Choose Your Plan</h1>
        <p className="text-gray-500">Select the plan that best fits your needs</p>

        <div className="flex justify-center items-center gap-4 mt-8">
          <Select value={billingInterval} onValueChange={(value: 'month' | 'year') => setBillingInterval(value)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select billing interval" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Billing Interval</SelectLabel>
                <SelectItem value="month">Monthly Billing</SelectItem>
                <SelectItem value="year">Annual Billing (Save 20%)</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans?.map((plan: Plan) => (
          <Card key={plan.id} className="relative overflow-hidden">
            <CardHeader>
              <CardTitle>{plan.name}</CardTitle>
              <CardDescription>{plan.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <p className="text-2xl font-bold">
                  ${billingInterval === 'month' ? plan.priceMonthly : plan.priceYearly}
                  <span className="text-sm font-normal">/{billingInterval}</span>
                </p>
                {plan.isStudent && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Includes 1-day free trial
                  </p>
                )}
              </div>

              <ul className="space-y-2 mb-6">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-primary" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                className="w-full"
                onClick={() => handleSubscribe(plan)}
                disabled={isLoading || plan.isEnterprise || processingPlanId === plan.id}
              >
                {isLoading && processingPlanId === plan.id ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Processing...
                  </>
                ) : plan.isEnterprise ? (
                  'Contact Sales'
                ) : (
                  'Subscribe Now'
                )}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}