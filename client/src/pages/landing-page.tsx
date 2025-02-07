import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Gavel, Scale, Shield, CheckCircle, FileSearch, Book, GitCompare } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="fixed w-full z-50 bg-white/80 backdrop-blur-lg border-b border-green-100">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Gavel className="h-6 w-6 text-green-600" />
            <span className="text-xl font-semibold text-gray-900">JurySync.io</span>
          </div>
          <div className="flex items-center space-x-8">
            <Link href="/products" className="text-gray-700 hover:text-green-600">Products</Link>
            <Link href="/customers" className="text-gray-700 hover:text-green-600">Customers</Link>
            <Link href="/pricing" className="text-gray-700 hover:text-green-600">Pricing</Link>
            <Link href="/company" className="text-gray-700 hover:text-green-600">Company</Link>
            <Link href="/login">
              <Button variant="ghost" className="text-gray-700 hover:text-green-600">Login</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 bg-gradient-to-br from-yellow-50 to-green-50 animate-gradient-x">
        <div className="container mx-auto max-w-6xl">
          <h1 className="text-7xl font-bold text-center mb-6 text-gray-900 font-display">
            Your Legal AI <br />
            Assistant
          </h1>
          <p className="text-xl text-center text-gray-600 mb-8 max-w-2xl mx-auto">
            Transform your legal practice with AI-powered document analysis, contract management, and legal research.
            Start with a 1-day free trial.
          </p>
          <div className="flex justify-center">
            <Link href="/register">
              <Button className="bg-green-600 hover:bg-green-700 text-lg py-6 px-8 rounded-lg shadow-lg">
                Start 1-Day Free Trial
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Products Section */}
      <section className="py-20 bg-white">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-4xl font-bold text-center mb-16 text-gray-900">
            AI-Powered Legal Solutions
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-yellow-50 p-8 rounded-xl border border-yellow-100 hover:shadow-lg transition-all group cursor-pointer">
              <div className="mb-6 relative">
                <div className="absolute inset-0 bg-green-500/10 rounded-full scale-110 group-hover:scale-125 transition-transform"></div>
                <GitCompare className="h-12 w-12 text-green-600 relative z-10" />
              </div>
              <h3 className="text-2xl font-semibold mb-4 text-gray-900">Contract Automation</h3>
              <p className="text-gray-600">
                Automatically draft, review, and manage legal contracts using AI agents that understand industry-standard templates and language nuances.
              </p>
            </div>
            <div className="bg-green-50 p-8 rounded-xl border border-green-100 hover:shadow-lg transition-all group cursor-pointer">
              <div className="mb-6 relative">
                <div className="absolute inset-0 bg-green-500/10 rounded-full scale-110 group-hover:scale-125 transition-transform"></div>
                <Shield className="h-12 w-12 text-green-600 relative z-10" />
              </div>
              <h3 className="text-2xl font-semibold mb-4 text-gray-900">Compliance Auditing</h3>
              <p className="text-gray-600">
                Scan and audit documents or regulatory updates, flagging inconsistencies and automating report generation.
              </p>
            </div>
            <div className="bg-yellow-50 p-8 rounded-xl border border-yellow-100 hover:shadow-lg transition-all group cursor-pointer">
              <div className="mb-6 relative">
                <div className="absolute inset-0 bg-green-500/10 rounded-full scale-110 group-hover:scale-125 transition-transform"></div>
                <Book className="h-12 w-12 text-green-600 relative z-10" />
              </div>
              <h3 className="text-2xl font-semibold mb-4 text-gray-900">Legal Research & Summarization</h3>
              <p className="text-gray-600">
                Analyze vast legal databases, extract relevant precedents, and summarize complex case law for quick decision-making.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-gradient-to-br from-yellow-50 to-green-50 animate-gradient-x">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-4xl font-bold text-center mb-16 text-gray-900">
            One Integrated, Secure Platform <br />
            for All Your Legal Work
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-12">
            <div className="bg-white/80 p-8 rounded-xl shadow-sm group hover:shadow-lg transition-all">
              <div className="mb-6 relative">
                <div className="absolute inset-0 bg-green-500/10 rounded-full scale-110 group-hover:scale-125 transition-transform"></div>
                <Scale className="h-12 w-12 text-green-600 relative z-10" />
              </div>
              <h3 className="text-2xl font-semibold mb-4 text-gray-900">AI-Powered Analysis</h3>
              <p className="text-gray-600">
                Get instant insights and analysis on legal documents with our advanced AI technology.
              </p>
            </div>
            <div className="bg-white/80 p-8 rounded-xl shadow-sm group hover:shadow-lg transition-all">
              <div className="mb-6 relative">
                <div className="absolute inset-0 bg-green-500/10 rounded-full scale-110 group-hover:scale-125 transition-transform"></div>
                <Shield className="h-12 w-12 text-green-600 relative z-10" />
              </div>
              <h3 className="text-2xl font-semibold mb-4 text-gray-900">Enterprise Security</h3>
              <p className="text-gray-600">
                Bank-grade encryption and security measures to protect your sensitive data.
              </p>
            </div>
            <div className="bg-white/80 p-8 rounded-xl shadow-sm group hover:shadow-lg transition-all">
              <div className="mb-6 relative">
                <div className="absolute inset-0 bg-green-500/10 rounded-full scale-110 group-hover:scale-125 transition-transform"></div>
                <CheckCircle className="h-12 w-12 text-green-600 relative z-10" />
              </div>
              <h3 className="text-2xl font-semibold mb-4 text-gray-900">Smart Automation</h3>
              <p className="text-gray-600">
                Streamline your workflow with intelligent document processing and management.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}