import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { AlertCircle } from "lucide-react";

export default function SubscriptionCancel() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-900">
      <Card className="w-full max-w-md mx-4 bg-gray-800 border-gray-700">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2">
            <AlertCircle className="h-8 w-8 text-red-500" />
            <h1 className="text-2xl font-bold text-gray-100">Subscription Cancelled</h1>
          </div>

          <p className="mt-4 text-sm text-gray-300">
            Your subscription process was cancelled. No changes have been made to your account.
          </p>

          <div className="mt-6">
            <Button asChild className="w-full">
              <Link href="/pricing">
                Return to Pricing
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
