import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Gavel, Shield, Sparkles, ArrowRight } from "lucide-react";

export default function LandingPage() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-white mb-6">
            JurySync Legal AI Assistant
          </h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Streamline your legal document workflow with AI-powered contract automation
          </p>
          <div className="mt-8 flex gap-4 justify-center">
            {!user ? (
              <>
                <Button asChild size="lg" className="bg-primary hover:bg-primary/90">
                  <Link href="/register">Start Free Trial</Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="text-white">
                  <Link href="/login">Sign In</Link>
                </Button>
              </>
            ) : (
              <Button asChild size="lg" className="bg-primary hover:bg-primary/90">
                <Link href="/dashboard">Go to Dashboard</Link>
              </Button>
            )}
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <Card className="p-6 bg-background/95 backdrop-blur-lg border-border">
            <Gavel className="h-12 w-12 text-primary mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">
              Legal Document Automation
            </h3>
            <p className="text-gray-300">
              Generate and customize legal documents with AI assistance
            </p>
          </Card>

          <Card className="p-6 bg-background/95 backdrop-blur-lg border-border">
            <Shield className="h-12 w-12 text-primary mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">
              Secure & Compliant
            </h3>
            <p className="text-gray-300">
              Enterprise-grade security with data encryption and compliance
            </p>
          </Card>

          <Card className="p-6 bg-background/95 backdrop-blur-lg border-border">
            <Sparkles className="h-12 w-12 text-primary mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">
              AI-Powered Analysis
            </h3>
            <p className="text-gray-300">
              Smart contract analysis and risk assessment
            </p>
          </Card>
        </div>

        <div className="text-center">
          <Link href="/pricing" className="inline-flex items-center text-primary hover:text-primary/90">
            View Pricing Plans <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}