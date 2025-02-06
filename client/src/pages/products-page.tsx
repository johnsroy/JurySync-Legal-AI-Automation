import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { GitCompare, Shield, Book, ArrowRight } from "lucide-react";

export default function ProductsPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Contract Automation Section */}
      <section className="min-h-screen flex flex-col justify-center py-32 relative">
        <div className="container mx-auto max-w-6xl px-4">
          <div className="mb-4 text-blue-500">Contract Automation</div>
          <h1 className="text-7xl font-bold mb-8">
            Tailored to Your Legal Expertise
          </h1>
          <p className="text-xl text-gray-400 mb-8 max-w-2xl">
            Delegate complex contract drafting and review tasks in natural language to your domain-specific AI assistant.
          </p>
          <Link href="/register">
            <Button className="bg-blue-600 hover:bg-blue-700 text-lg py-6 px-8">
              Start Free Trial <ArrowRight className="ml-2" />
            </Button>
          </Link>
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#111] pointer-events-none" />
      </section>

      {/* Compliance Auditing Section */}
      <section className="min-h-screen flex flex-col justify-center py-32 bg-[#111] relative">
        <div className="container mx-auto max-w-6xl px-4">
          <div className="mb-4 text-blue-500">Compliance Auditing</div>
          <h1 className="text-7xl font-bold mb-8">
            Rapid Compliance, <br />Grounded Results
          </h1>
          <p className="text-xl text-gray-400 mb-8 max-w-2xl">
            Get instant compliance analysis across multiple domains in legal, regulatory, and tax with accurate citations.
          </p>
          <Link href="/register">
            <Button className="bg-blue-600 hover:bg-blue-700 text-lg py-6 px-8">
              Try It Now <ArrowRight className="ml-2" />
            </Button>
          </Link>
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black pointer-events-none" />
      </section>

      {/* Legal Research Section */}
      <section className="min-h-screen flex flex-col justify-center py-32 bg-black relative">
        <div className="container mx-auto max-w-6xl px-4">
          <div className="mb-4 text-blue-500">Legal Research & Summarization</div>
          <h1 className="text-7xl font-bold mb-8">
            Your AI Research Assistant
          </h1>
          <p className="text-xl text-gray-400 mb-8 max-w-2xl">
            Analyze vast legal databases, extract relevant precedents, and get instant summaries of complex case law for quick decision-making.
          </p>
          <Link href="/register">
            <Button className="bg-blue-600 hover:bg-blue-700 text-lg py-6 px-8">
              Explore Features <ArrowRight className="ml-2" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-32 bg-[#0a0a0a]">
        <div className="container mx-auto max-w-6xl px-4">
          <h2 className="text-4xl font-bold text-center mb-16">
            Powerful Features for Legal Professionals
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-[#111] p-8 rounded-xl">
              <GitCompare className="h-12 w-12 mb-6 text-blue-500" />
              <h3 className="text-2xl font-semibold mb-4">Advanced Contract Analysis</h3>
              <p className="text-gray-400">
                Smart contract parsing and analysis with industry-standard clause detection.
              </p>
            </div>
            <div className="bg-[#111] p-8 rounded-xl">
              <Shield className="h-12 w-12 mb-6 text-blue-500" />
              <h3 className="text-2xl font-semibold mb-4">Regulatory Compliance</h3>
              <p className="text-gray-400">
                Stay compliant with automated regulatory updates and real-time monitoring.
              </p>
            </div>
            <div className="bg-[#111] p-8 rounded-xl">
              <Book className="h-12 w-12 mb-6 text-blue-500" />
              <h3 className="text-2xl font-semibold mb-4">Case Law Analysis</h3>
              <p className="text-gray-400">
                Intelligent precedent search and automated case law summarization.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
