import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Gavel, Check, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

const PRICING_PLANS = [
  {
    id: 1,
    name: "Basic",
    description: "Perfect for individuals and small teams",
    price: "29",
    interval: "month",
    features: [
      "Basic document analysis",
      "Standard support",
      "Up to 100 documents/month",
      "Email support"
    ]
  },
  {
    id: 2,
    name: "Professional",
    description: "Ideal for growing businesses",
    price: "99",
    interval: "month",
    features: [
      "Everything in Basic, plus:",
      "Advanced analytics",
      "Priority support",
      "Unlimited documents",
      "API access"
    ]
  }
];

export default function PricingPage() {
  const [billingPeriod] = useState<"monthly" | "yearly">("monthly");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();

  const handleSubscribe = async (plan: typeof PRICING_PLANS[0]) => {
    if (!user) {
      navigate(`/register?plan=${plan.id}`);
      return;
    }
    navigate(`/subscription?plan=${plan.id}`);
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
          <p className="text-lg text-gray-600">Choose the plan that's right for you</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {PRICING_PLANS.map((plan) => (
            <Card key={plan.id} className="relative">
              <CardHeader>
                <CardTitle>{plan.name}</CardTitle>
                <div className="mt-4">
                  <div className="flex items-baseline">
                    <span className="text-sm font-semibold text-gray-500">$</span>
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className="text-sm text-gray-500 ml-1">/{plan.interval}</span>
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
                >
                  Start Free Trial
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