import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Gavel, Scale, Shield, CheckCircle, FileSearch, Book, GitCompare } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Navigation */}
      <nav className="fixed w-full z-50 bg-[#0a0a0a]/80 backdrop-blur-lg border-b border-white/10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Gavel className="h-6 w-6" />
            <span className="text-xl font-semibold">JurySync</span>
          </div>
          <div className="flex items-center space-x-8">
            <Link href="/products" className="hover:text-blue-400">Products</Link>
            <Link href="/customers" className="hover:text-blue-400">Customers</Link>
            <Link href="/security" className="hover:text-blue-400">Security</Link>
            <Link href="/news" className="hover:text-blue-400">News</Link>
            <Link href="/company" className="hover:text-blue-400">Company</Link>
            <Link href="/login">
              <Button variant="ghost" className="hover:text-blue-400">Login</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <h1 className="text-7xl font-bold text-center mb-6">
            Legal AI Agent <br />
            for Professionals
          </h1>
          <p className="text-xl text-center text-gray-400 mb-8 max-w-2xl mx-auto">
            Transform your legal practice with AI-powered document analysis, contract management, and legal research.
          </p>
          <div className="flex justify-center">
            <Link href="/register">
              <Button className="bg-blue-600 hover:bg-blue-700 text-lg py-6 px-8">
                Start Free Trial
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Products Section */}
      <section className="py-20 bg-[#111]">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-4xl font-bold text-center mb-16">
            Powerful AI Solutions for Legal Professionals
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-[#0a0a0a] p-8 rounded-xl border border-white/10">
              <GitCompare className="h-12 w-12 mb-6 text-blue-500" />
              <h3 className="text-2xl font-semibold mb-4">Contract Automation</h3>
              <p className="text-gray-400">
                Automatically draft, review, and manage legal contracts using AI agents that understand industry-standard templates and language nuances.
              </p>
            </div>
            <div className="bg-[#0a0a0a] p-8 rounded-xl border border-white/10">
              <Shield className="h-12 w-12 mb-6 text-blue-500" />
              <h3 className="text-2xl font-semibold mb-4">Compliance Auditing</h3>
              <p className="text-gray-400">
                Scan and audit documents or regulatory updates, flagging inconsistencies and automating report generation.
              </p>
            </div>
            <div className="bg-[#0a0a0a] p-8 rounded-xl border border-white/10">
              <Book className="h-12 w-12 mb-6 text-blue-500" />
              <h3 className="text-2xl font-semibold mb-4">Legal Research & Summarization</h3>
              <p className="text-gray-400">
                Analyze vast legal databases, extract relevant precedents, and summarize complex case law for quick decision-making.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Client Logos */}
      <section className="py-20 bg-[#111]">
        <div className="container mx-auto">
          <h3 className="text-2xl font-semibold text-center mb-12">Built for Industry Leaders</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-12 items-center opacity-60">
            {Array(6).fill(0).map((_, i) => (
              <div key={i} className="h-12 bg-gray-800/50 rounded-lg"></div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-4xl font-bold text-center mb-16">
            Augment All of Your Work on <br />
            One Integrated, Secure Platform
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-12">
            <div className="bg-[#111] p-8 rounded-xl">
              <Scale className="h-12 w-12 mb-6 text-blue-500" />
              <h3 className="text-2xl font-semibold mb-4">AI-Powered Analysis</h3>
              <p className="text-gray-400">
                Get instant insights and analysis on legal documents with our advanced AI technology.
              </p>
            </div>
            <div className="bg-[#111] p-8 rounded-xl">
              <Shield className="h-12 w-12 mb-6 text-blue-500" />
              <h3 className="text-2xl font-semibold mb-4">Enterprise Security</h3>
              <p className="text-gray-400">
                Bank-grade encryption and security measures to protect your sensitive data.
              </p>
            </div>
            <div className="bg-[#111] p-8 rounded-xl">
              <CheckCircle className="h-12 w-12 mb-6 text-blue-500" />
              <h3 className="text-2xl font-semibold mb-4">Smart Automation</h3>
              <p className="text-gray-400">
                Streamline your workflow with intelligent document processing and management.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}