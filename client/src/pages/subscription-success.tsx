import { useEffect } from "react";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";

export default function SubscriptionSuccess() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    // Verify the subscription status with your backend
    const verifySubscription = async () => {
      try {
        const sessionId = new URLSearchParams(window.location.search).get('session_id');
        const response = await fetch(`/api/subscription/verify/${sessionId}`);
        
        if (!response.ok) {
          throw new Error('Failed to verify subscription');
        }
      } catch (error) {
        console.error('Verification error:', error);
      }
    };

    verifySubscription();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800 p-4">
      <Card className="w-full max-w-md p-8 text-center space-y-6">
        <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
        <h1 className="text-2xl font-bold">Subscription Activated!</h1>
        <p className="text-gray-500">
          Thank you for subscribing to JurySync. Your account has been activated.
        </p>
        <Button
          onClick={() => setLocation("/dashboard")}
          className="w-full"
        >
          Go to Dashboard
        </Button>
      </Card>
    </div>
  );
} 