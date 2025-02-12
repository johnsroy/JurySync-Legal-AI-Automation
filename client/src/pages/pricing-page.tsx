import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Gavel, Check, ChevronRight, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PRICING_PLANS } from "@shared/schema/pricing";

export default function PricingPage() {
  const [isLoading, setIsLoading] = useState<{[key: string]: boolean}>({});
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const handleSubscribe = async (plan: typeof PRICING_PLANS[0]) => {
    if (plan.tier === 'enterprise') {
      window.location.href = "mailto:contact@jurysync.io?subject=Enterprise%20Plan%20Inquiry";
      return;
    }

    try {
      setIsLoading(prev => ({ ...prev, [plan.id]: true }));

      if (!plan.priceId) {
        throw new Error('Invalid plan configuration');
      }

      setLocation(`/subscription?plan=${plan.id}`);
    } catch (error) {
      console.error('Subscription error:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to process subscription',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(prev => ({ ...prev, [plan.id]: false }));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-green-50">
      <nav className="fixed w-full z-50 bg-white/80 backdrop-blur-lg border-b border-green-100">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <a href="/" className="flex items-center space-x-2">
            <Gavel className="h-6 w-6 text-green-600" />
            <span className="text-xl font-semibold text-gray-900">JurySync.io</span>
          </a>
          <div className="flex items-center space-x-8">
            <a href="/products" className="text-gray-700 hover:text-green-600">Products</a>
            <a href="/pricing" className="text-gray-700 hover:text-green-600">Pricing</a>
            <a href="/company" className="text-gray-700 hover:text-green-600">Company</a>
          </div>
        </div>
      </nav>

      <main className="container mx-auto pt-32 px-4 pb-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Simple, Transparent Pricing</h1>
          <p className="text-lg text-gray-600">Get started with JurySync.io today</p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-7xl mx-auto">
          {PRICING_PLANS.map((plan) => (
            <Card key={plan.id} className="relative">
              <CardHeader>
                <CardTitle>{plan.name}</CardTitle>
                <div className="mt-4">
                  <div className="flex items-baseline">
                    {plan.tier === 'enterprise' ? (
                      <span className="text-4xl font-bold">Custom</span>
                    ) : (
                      <>
                        <span className="text-sm font-semibold text-gray-500">$</span>
                        <span className="text-4xl font-bold">{plan.price}</span>
                        <span className="text-sm text-gray-500 ml-1">/{plan.interval}</span>
                      </>
                    )}
                  </div>
                  <p className="text-gray-600 mt-2">{plan.description}</p>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start">
                      <Check className="h-5 w-5 text-green-500 mr-2 shrink-0" />
                      <span className="text-gray-600 text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button 
                  className="w-full bg-green-600 hover:bg-green-700"
                  onClick={() => handleSubscribe(plan)}
                  disabled={isLoading[plan.id]}
                >
                  {isLoading[plan.id] ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      {plan.tier === 'enterprise' ? "Contact Us" : "Start Free Trial"}
                      <ChevronRight className="h-4 w-4 ml-2" />
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}