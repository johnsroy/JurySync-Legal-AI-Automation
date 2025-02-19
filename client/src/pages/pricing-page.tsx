import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Gavel, Check, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";

const PRICING_PLANS = [
  {
    id: "student-monthly",
    name: "Student",
    description: "Perfect for law students and academic research",
    price: "24",
    interval: "month",
    tier: "student",
    priceId: "price_student_monthly",
    features: [
      "Full access to legal research tools",
      "Basic document analysis",
      "Access to precedent database",
      "Email support"
    ]
  },
  {
    id: "professional-monthly",
    name: "Professional",
    description: "Ideal for law firms and legal professionals",
    price: "99",
    interval: "month",
    tier: "professional",
    priceId: "price_professional_monthly",
    features: [
      "Everything in Student, plus:",
      "Advanced document automation",
      "Priority support",
      "Custom workflows",
      "Team collaboration features"
    ]
  },
  {
    id: "enterprise",
    name: "Enterprise",
    description: "Custom solutions for large organizations",
    price: "Custom",
    interval: "month",
    tier: "enterprise",
    features: [
      "Everything in Professional, plus:",
      "Custom integrations",
      "Dedicated account manager",
      "SLA guarantees",
      "On-premise deployment options"
    ]
  }
];

export default function PricingPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const handleSubscribe = async (plan: typeof PRICING_PLANS[0]) => {
    if (plan.tier === "enterprise") {
      window.location.href = "mailto:contact@jurysync.io?subject=Enterprise%20Plan%20Inquiry";
      return;
    }

    if (!user) {
      navigate(`/register?plan=${plan.id}`);
      return;
    }

    try {
      setIsLoading(true);
      const response = await apiRequest("POST", "/api/payments/create-checkout-session", {
        priceId: plan.priceId,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create checkout session");
      }

      const { sessionId, url } = await response.json();

      if (url) {
        window.location.href = url;
      } else {
        throw new Error("No checkout URL received");
      }
    } catch (error) {
      console.error("Failed to start subscription:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to start subscription",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
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
            <a href="/customers" className="text-gray-700 hover:text-green-600">Customers</a>
            <a href="/pricing" className="text-gray-700 hover:text-green-600">Pricing</a>
            <a href="/company" className="text-gray-700 hover:text-green-600">Company</a>
            {user ? (
              <Button variant="ghost" onClick={() => navigate('/dashboard')}>
                Dashboard
              </Button>
            ) : (
              <Button variant="ghost" onClick={() => navigate('/login')}>
                Login
              </Button>
            )}
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
            <Card key={plan.id} className={`relative ${plan.tier === 'professional' ? 'border-green-500 shadow-lg' : ''}`}>
              {plan.tier === 'professional' && (
                <div className="absolute top-0 right-0 bg-green-500 text-white text-sm px-3 py-1 rounded-bl-lg rounded-tr-lg">
                  Most Popular
                </div>
              )}
              <CardHeader>
                <CardTitle>{plan.name}</CardTitle>
                <div className="mt-4">
                  <div className="flex items-baseline">
                    {plan.tier === "enterprise" ? (
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
                  disabled={isLoading}
                >
                  {isLoading ? "Processing..." : (plan.tier === "enterprise" ? "Contact Us" : "Pay Now")}
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}