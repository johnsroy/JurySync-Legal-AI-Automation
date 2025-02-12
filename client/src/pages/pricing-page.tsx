import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Gavel, Check, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { PRICING_PLANS } from "@shared/schema/pricing";

export default function PricingPage() {
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">("monthly");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();

  const filteredPlans = PRICING_PLANS.filter(plan => {
    if (billingPeriod === "monthly") {
      return plan.interval === "month";
    } else {
      return plan.interval === "year";
    }
  });

  const handleSubscribe = async (plan: typeof PRICING_PLANS[0]) => {
    if (plan.tier === "enterprise") {
      window.location.href = "mailto:contact@jurysync.io?subject=Enterprise%20Plan%20Inquiry";
      return;
    }

    if (!user) {
      // If user is not logged in, redirect to register with plan info
      navigate(`/register?plan=${plan.id}`);
      return;
    }

    // Redirect to subscription page for Student and Professional plans
    navigate("/subscription");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-green-50 animate-gradient-x">
      <nav className="fixed w-full z-50 bg-white/80 backdrop-blur-lg border-b border-green-100">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-2">
            <Gavel className="h-6 w-6 text-green-600" />
            <span className="text-xl font-semibold text-gray-900">JurySync.io</span>
          </Link>
          <div className="flex items-center space-x-8">
            <Link href="/products" className="text-gray-700 hover:text-green-600">Products</Link>
            <Link href="/customers" className="text-gray-700 hover:text-green-600">Customers</Link>
            <Link href="/pricing" className="text-gray-700 hover:text-green-600">Pricing</Link>
            <Link href="/company" className="text-gray-700 hover:text-green-600">Company</Link>
            {user ? (
              <Link href="/dashboard">
                <Button variant="ghost" className="text-gray-700 hover:text-green-600">Dashboard</Button>
              </Link>
            ) : (
              <Link href="/login">
                <Button variant="ghost" className="text-gray-700 hover:text-green-600">Login</Button>
              </Link>
            )}
          </div>
        </div>
      </nav>

      <main className="container mx-auto pt-32 px-4 pb-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Simple, Transparent Pricing</h1>
          <p className="text-lg text-gray-600">Get started with JurySync.io today</p>

          <div className="flex justify-center mt-8 space-x-2 bg-white/50 backdrop-blur-sm p-1 rounded-lg inline-flex">
            <Button
              variant={billingPeriod === "monthly" ? "default" : "ghost"}
              onClick={() => setBillingPeriod("monthly")}
              className="relative"
            >
              Monthly
            </Button>
            <Button
              variant={billingPeriod === "yearly" ? "default" : "ghost"}
              onClick={() => setBillingPeriod("yearly")}
              className="relative"
            >
              Yearly
              <span className="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full">
                Save 17%
              </span>
            </Button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-7xl mx-auto">
          {filteredPlans.map((plan) => (
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
                  {plan.tier !== "enterprise" && billingPeriod === "yearly" && (
                    <div className="text-sm text-green-500 mt-1">Save 17% with annual billing</div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 mb-6">{plan.description}</p>
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
                  {plan.tier === "enterprise" ? "Contact Us" : "Start Your Free Trial"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}