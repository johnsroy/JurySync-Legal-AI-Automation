import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { XCircle } from "lucide-react";

export default function SubscriptionCancel() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800 p-4">
      <Card className="w-full max-w-md p-8 text-center space-y-6 bg-background/95 backdrop-blur-lg shadow-xl border-border">
        <XCircle className="h-16 w-16 text-red-500 mx-auto" />
        <h1 className="text-2xl font-bold text-white">Subscription Cancelled</h1>
        <div className="space-y-4">
          <p className="text-gray-300">
            Your subscription process was cancelled. You can still enjoy your free trial period.
          </p>
          <p className="text-gray-400 text-sm">
            If you experienced any issues or have questions, please contact our support team.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <Button
            onClick={() => setLocation("/pricing")}
            variant="default"
            className="w-full bg-primary hover:bg-primary/90"
          >
            View Plans
          </Button>
          <Button
            onClick={() => setLocation("/dashboard")}
            variant="outline"
            className="w-full text-gray-200 hover:text-white"
          >
            Return to Dashboard
          </Button>
        </div>
      </Card>
    </div>
  );
}
