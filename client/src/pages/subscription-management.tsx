import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { apiRequest } from '@/lib/queryClient';
import { useQuery } from '@tanstack/react-query';
import { 
  Loader2,
  CreditCard,
  Calendar,
  AlertCircle,
  CheckCircle,
  XCircle
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function SubscriptionManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  const { data: subscription, isLoading: isLoadingSubscription } = useQuery({
    queryKey: ['/api/payments/current-subscription'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/payments/current-subscription');
      if (!response.ok) throw new Error('Failed to fetch subscription');
      return response.json();
    },
  });

  if (!user) return null;

  const handleCancelSubscription = async () => {
    try {
      setIsLoading(true);

      const response = await apiRequest('POST', '/api/payments/cancel-subscription', {
        subscriptionId: subscription.stripeSubscriptionId
      });

      if (!response.ok) throw new Error('Failed to cancel subscription');

      toast({
        title: 'Subscription Cancelled',
        description: 'Your subscription will end at the current billing period',
      });

      setShowCancelDialog(false);
    } catch (error) {
      console.error('Cancel subscription error:', error);
      toast({
        title: 'Cancellation Failed',
        description: error instanceof Error ? error.message : 'Failed to cancel subscription',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoadingSubscription) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Subscription Management</h1>

        {subscription ? (
          <Card>
            <CardHeader>
              <CardTitle>Current Subscription</CardTitle>
              <CardDescription>Manage your subscription and billing details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <CreditCard className="h-6 w-6 text-primary" />
                  <div>
                    <p className="font-medium">{subscription.plan.name}</p>
                    <p className="text-sm text-muted-foreground">
                      ${subscription.plan.priceMonthly}/month
                    </p>
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm ${
                  subscription.status === 'active'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1)}
                </span>
              </div>

              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm">
                    Current Period: {new Date(subscription.currentPeriodStart).toLocaleDateString()} - {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                  </p>
                </div>
                {subscription.cancelAtPeriodEnd && (
                  <div className="flex items-center space-x-2 text-yellow-600">
                    <AlertCircle className="h-4 w-4" />
                    <p className="text-sm">
                      Your subscription will end on {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex space-x-4">
                <Button variant="outline" asChild>
                  <a href="/subscription">Change Plan</a>
                </Button>
                {!subscription.cancelAtPeriodEnd && (
                  <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
                    <DialogTrigger asChild>
                      <Button variant="destructive">Cancel Subscription</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Cancel Subscription</DialogTitle>
                        <DialogDescription>
                          Are you sure you want to cancel your subscription? You'll continue to have access until the end of your current billing period.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="flex justify-end space-x-4">
                        <Button
                          variant="outline"
                          onClick={() => setShowCancelDialog(false)}
                        >
                          Keep Subscription
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={handleCancelSubscription}
                          disabled={isLoading}
                        >
                          {isLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : null}
                          Confirm Cancellation
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-8">
              <div className="text-center">
                <XCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No Active Subscription</h3>
                <p className="text-muted-foreground mb-6">
                  You don't have an active subscription. Choose a plan to get started.
                </p>
                <Button asChild>
                  <a href="/subscription">View Plans</a>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
