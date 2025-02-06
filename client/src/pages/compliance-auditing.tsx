import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Gavel, LogOut, Loader2, Shield, Upload, FileText } from "lucide-react";

export default function ComplianceAuditing() {
  const { user, logoutMutation } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-green-50 animate-gradient-x">
      <header className="bg-white/80 backdrop-blur-lg border-b border-green-100">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/dashboard" className="flex items-center space-x-4 hover:text-green-600">
              <Gavel className="h-6 w-6 text-green-600" />
              <h1 className="text-xl font-semibold">JurySync.io</h1>
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              Welcome, {user?.firstName} {user?.lastName}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
            >
              {logoutMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <LogOut className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <Shield className="h-8 w-8 text-green-600" />
            <h2 className="text-3xl font-bold">Compliance Auditing</h2>
          </div>

          <div className="grid gap-6">
            <Card className="bg-white/80 backdrop-blur-lg">
              <CardContent className="p-8">
                <div className="flex flex-col items-center justify-center py-12">
                  <Upload className="h-16 w-16 text-gray-400 mb-4" />
                  <h3 className="text-xl font-semibold mb-2">Upload Documents for Compliance Review</h3>
                  <p className="text-gray-600 text-center mb-6">
                    Upload regulatory documents, contracts, or policies for automated compliance analysis
                  </p>
                  <Button className="bg-green-600 hover:bg-green-700">
                    <FileText className="h-4 w-4 mr-2" />
                    Select Documents
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/80 backdrop-blur-lg">
              <CardHeader>
                <CardTitle>Recent Compliance Audits</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">No compliance audits performed yet.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
