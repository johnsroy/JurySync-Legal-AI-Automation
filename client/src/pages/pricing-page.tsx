import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Gavel, Check, ChevronRight } from "lucide-react";
import { loadStripe } from "@stripe/stripe-js";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

interface Plan {
  name: string;
  price: string;
  period?: string;
  savings?: string;
  description: string;
  features: string[];
  note?: string;
  highlighted?: boolean;
  planType: string;
  cta: string;
  href: string;
}

const plans: { monthly: Plan[]; yearly: Plan[] } = {
  monthly: [
    {
      name: "Student",
      price: "24",
      description: "For the budding legal minds. Access all the features of JurySync.io.",
      features: [
        "Full access to our all-in-one AI legal assistant",
        "Discounted rate geared for students",
        "Free 1 Day Trial",
      ],
      note: "(Sign up with a .edu email for the Student Rate)",
      cta: "Connect",
      planType: "student-monthly",
      href: "/register?plan=student"
    },
    {
      name: "Professional",
      price: "194",
      description: "Designed for legal professionals who want to apply cutting-edge AI to their legal work.",
      features: [
        "Full access to our all-in-one AI legal assistant",
        "Drafting assistance for memos, emails, legal briefs",
        "Comprehensive Federal and State regulations knowledge base",
        "Custom document uploads for personalized insights",
        "Streamlined Contract Review with AI insights",
        "Regulatory compliance reviews for your documents",
        "Intuitive Boolean search composer"
      ],
      highlighted: true,
      planType: "professional-monthly",
      cta: "Start Your Free Trial",
      href: "/register?plan=professional"
    },
    {
      name: "Enterprise",
      price: "Custom",
      description: "Built for law firms and corporate legal departments looking for enhanced security and collaboration features.",
      features: [
        "All the benefits of the Professional Plan",
        "Single Sign-On (SSO) for enhanced security",
        "Advanced user management capabilities",
        "Collaboration features for shared document sets",
        "Dedicated support and account manager"
      ],
      cta: "Contact Us",
      planType: "enterprise",
      href: "mailto:contact@jurysync.io?subject=Enterprise%20Plan%20Inquiry"
    }
  ],
  yearly: [
    {
      name: "Student",
      price: "20",
      period: "280/year",
      savings: "Save 14%",
      description: "For the budding legal minds. Access all the features of JurySync.io.",
      features: [
        "Full access to our all-in-one AI legal assistant",
        "Discounted rate geared for students",
        "Free 1 Day Trial",
      ],
      note: "(Sign up with a .edu email for the Student Rate)",
      planType: "student-yearly",
      cta: "Connect",
      href: "/register?plan=student-yearly"
    },
    {
      name: "Professional",
      price: "154",
      period: "1,888/year",
      savings: "Save 20%",
      description: "Designed for legal professionals who want to apply cutting-edge AI to their legal work.",
      features: [
        "Full access to our all-in-one AI legal assistant",
        "Drafting assistance for memos, emails, legal briefs",
        "Comprehensive Federal and State regulations knowledge base",
        "Custom document uploads for personalized insights",
        "Streamlined Contract Review with AI insights",
        "Regulatory compliance reviews for your documents",
        "Search laws, case laws and regulations"
      ],
      highlighted: true,
      planType: "professional-yearly",
      cta: "Start Your Free Trial",
      href: "/register?plan=professional-yearly"
    },
    {
      name: "Enterprise",
      price: "Custom",
      description: "Built for law firms and corporate legal departments looking for enhanced security and collaboration features.",
      features: [
        "All the benefits of the Professional Plan",
        "Single Sign-On (SSO) for enhanced security",
        "Advanced user management capabilities",
        "Collaboration features for shared document sets",
        "Dedicated support and account manager"
      ],
      cta: "Contact Us",
      planType: "enterprise",
      href: "mailto:contact@jurysync.io?subject=Enterprise%20Plan%20Inquiry"
    }
  ]
};

export default function PricingPage() {
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">("monthly");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();

  const handleSubscribe = async (plan: Plan) => {
    if (plan.price === "Custom") {
      window.location.href = plan.href;
      return;
    }

    if (!user) {
      // If user is not logged in, redirect to register with plan info
      navigate(`/register?plan=${plan.planType}`);
      return;
    }

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ planType: plan.planType }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Payment initialization failed");
      }

      const { sessionId } = await response.json();
      const stripe = await stripePromise;

      if (!stripe) throw new Error("Stripe failed to load");

      const { error } = await stripe.redirectToCheckout({ sessionId });
      if (error) throw error;
    } catch (error) {
      console.error("Payment error:", error);
      toast({
        title: "Payment Error",
        description: error instanceof Error ? error.message : "Failed to process payment. Please try again.",
        variant: "destructive"
      });
    }
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
                Save 20%
              </span>
            </Button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-7xl mx-auto">
          {plans[billingPeriod].map((plan) => (
            <Card key={plan.name} className={`relative ${plan.highlighted ? 'border-green-500 shadow-lg' : ''}`}>
              {plan.highlighted && (
                <div className="absolute top-0 right-0 bg-green-500 text-white text-sm px-3 py-1 rounded-bl-lg rounded-tr-lg">
                  Most Popular
                </div>
              )}
              <CardHeader>
                <CardTitle>{plan.name}</CardTitle>
                <div className="mt-4">
                  <div className="flex items-baseline">
                    {plan.price === "Custom" ? (
                      <span className="text-4xl font-bold">Custom</span>
                    ) : (
                      <>
                        <span className="text-sm font-semibold text-gray-500">$</span>
                        <span className="text-4xl font-bold">{plan.price}</span>
                        <span className="text-sm text-gray-500 ml-1">/month</span>
                      </>
                    )}
                  </div>
                  {plan.period && (
                    <div className="text-sm text-gray-500 mt-1">
                      ${plan.period} <span className="text-green-500 ml-1">{plan.savings}</span>
                    </div>
                  )}
                  {plan.note && (
                    <div className="text-sm text-gray-500 mt-2">{plan.note}</div>
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
                  {plan.cta}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}