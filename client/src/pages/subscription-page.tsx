import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { apiRequest } from '@/lib/queryClient';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import { Loader2, CheckCircle } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

interface Plan {
  id: number;
  name: string;
  description: string;
  priceMonthly: number;
  priceYearly: number;
  features: string[];
  isStudent: boolean;
  isEnterprise: boolean;
}

export default function SubscriptionPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [billingInterval, setBillingInterval] = useState<'month' | 'year'>('month');
  const [isLoading, setIsLoading] = useState(false);

  const { data: plans, isLoading: isLoadingPlans } = useQuery({
    queryKey: ['/api/payments/plans'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/payments/plans');
      if (!response.ok) throw new Error('Failed to fetch plans');
      return response.json();
    },
  });

  if (!user) return null;

  const handleSubscribe = async (plan: Plan) => {
    if (plan.isEnterprise) {
      window.location.href = 'mailto:enterprise@jurysync.io?subject=Enterprise Plan Inquiry';
      return;
    }

    try {
      setIsLoading(true);

      if (plan.isStudent) {
        const verifyResponse = await apiRequest('POST', '/api/payments/verify-student', {
          email: user.email
        });

        if (!verifyResponse.ok) {
          toast({
            title: 'Invalid Student Email',
            description: 'Please use a valid .edu email address',
            variant: 'destructive',
          });
          return;
        }
      }

      const stripe = await stripePromise;
      if (!stripe) throw new Error('Stripe failed to load');

      const response = await apiRequest('POST', '/api/payments/create-checkout-session', {
        planId: plan.id,
        interval: billingInterval,
      });

      if (!response.ok) throw new Error('Failed to create checkout session');

      const { sessionId } = await response.json();

      const { error } = await stripe.redirectToCheckout({
        sessionId
      });

      if (error) {
        throw new Error(error.message);
      }
    } catch (error) {
      console.error('Payment error:', error);
      toast({
        title: 'Payment Failed',
        description: error instanceof Error ? error.message : 'Failed to process payment',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
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
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Choose Your Plan</h1>
          <p className="text-muted-foreground">
            Select the plan that best fits your needs
          </p>

          <div className="flex items-center justify-center mt-8 space-x-4">
            <Select
              value={billingInterval}
              onValueChange={(value) => setBillingInterval(value as 'month' | 'year')}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select billing interval" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="month">Monthly Billing</SelectItem>
                <SelectItem value="year">Annual Billing (Save 20%)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {plans?.map((plan: Plan) => (
            <Card key={plan.id} className="relative overflow-hidden">
              <CardHeader>
                <CardTitle>{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
                <div className="mt-4">
                  <span className="text-3xl font-bold">
                    ${billingInterval === 'month' ? plan.priceMonthly : plan.priceYearly}
                  </span>
                  <span className="text-muted-foreground">
                    /{billingInterval}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-4">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-center">
                      <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full mt-6"
                  onClick={() => handleSubscribe(plan)}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  {plan.isEnterprise ? 'Contact Sales' : 'Subscribe Now'}
                </Button>
                {plan.isStudent && (
                  <p className="text-sm text-muted-foreground mt-4 text-center">
                    * Requires valid .edu email
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}