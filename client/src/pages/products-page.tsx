import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { 
  GitCompare, Shield, Book, ArrowRight, FileText, 
  Gavel, Brain, FileSearch, CloudUpload, BarChart2 
} from "lucide-react";

export default function ProductsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-green-50 text-gray-900">
      {/* Navigation */}
      <nav className="fixed w-full z-50 bg-white/80 backdrop-blur-lg border-b border-green-100">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-2">
            <Gavel className="h-6 w-6 text-green-600" />
            <span className="text-xl font-semibold text-gray-900">JurySync.io</span>
          </Link>
          <div className="flex items-center space-x-8">
            <Link href="/products" className="text-gray-700 hover:text-green-600">Products</Link>
            <Link href="/pricing" className="text-gray-700 hover:text-green-600">Pricing</Link>
            <Link href="/login">
              <Button variant="ghost" className="text-gray-700 hover:text-green-600">Login</Button>
            </Link>
            <Link href="/register">
              <Button className="bg-green-600 hover:bg-green-700 text-white">
                Start 1-Day Free Trial
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="min-h-screen flex flex-col justify-center py-32 relative pt-40">
        <div className="container mx-auto max-w-6xl px-4">
          <div className="mb-4 text-green-600">JurySync Document Intelligence Platform</div>
          <h1 className="text-7xl font-bold mb-8 text-gray-900">
            Supercharge Your Legal Workflow
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl">
            Our AI-powered document platform streamlines legal work, automates compliance checks, and accelerates research to save you time and improve accuracy.
          </p>
          <Link href="/register">
            <Button className="bg-green-600 hover:bg-green-700 text-lg py-6 px-8">
              Start 1-Day Free Trial <ArrowRight className="ml-2" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Document Processing Section */}
      <section className="min-h-screen flex flex-col justify-center py-32 bg-white relative">
        <div className="container mx-auto max-w-6xl px-4">
          <div className="mb-4 text-green-600">Document Processing</div>
          <h2 className="text-6xl font-bold mb-8 text-gray-900">
            Intelligent Document <br/>Handling
          </h2>
          <p className="text-xl text-gray-600 mb-12 max-w-2xl">
            Upload and process PDFs, Word documents, and plain text files with our advanced text extraction technology.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
            <div className="bg-green-50 p-8 rounded-xl border border-green-100 shadow-sm">
              <CloudUpload className="w-10 h-10 text-green-600 mb-4" />
              <h3 className="text-2xl font-bold mb-3 text-gray-900">Smart Document Upload</h3>
              <p className="text-gray-600">Process multiple document formats with automatic content extraction that preserves document structure.</p>
            </div>
            
            <div className="bg-green-50 p-8 rounded-xl border border-green-100 shadow-sm">
              <FileText className="w-10 h-10 text-green-600 mb-4" />
              <h3 className="text-2xl font-bold mb-3 text-gray-900">PDF Intelligence</h3>
              <p className="text-gray-600">Advanced PDF parsing capabilities to extract text and metadata from even complex documents.</p>
            </div>
            
            <div className="bg-green-50 p-8 rounded-xl border border-green-100 shadow-sm">
              <GitCompare className="w-10 h-10 text-green-600 mb-4" />
              <h3 className="text-2xl font-bold mb-3 text-gray-900">Document Conversion</h3>
              <p className="text-gray-600">Convert between document formats while maintaining content integrity.</p>
            </div>
          </div>
          
          <Link href="/register">
            <Button className="bg-green-600 hover:bg-green-700 text-lg py-6 px-8">
              Try Document Processing <ArrowRight className="ml-2" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Contract Automation Section */}
      <section className="min-h-screen flex flex-col justify-center py-32 bg-gradient-to-br from-yellow-50 to-green-50 relative">
        <div className="container mx-auto max-w-6xl px-4">
          <div className="mb-4 text-green-600">Contract Automation</div>
          <h2 className="text-6xl font-bold mb-8 text-gray-900">
            Tailored to Your <br/>Legal Expertise
          </h2>
          <p className="text-xl text-gray-600 mb-12 max-w-2xl">
            Delegate complex contract drafting and review tasks in natural language to your domain-specific AI assistant.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
            <div className="bg-white p-8 rounded-xl shadow-sm">
              <Gavel className="w-10 h-10 text-green-600 mb-4" />
              <h3 className="text-2xl font-bold mb-3 text-gray-900">Contract Creation</h3>
              <p className="text-gray-600">Generate customized legal agreements with AI assistance based on your requirements.</p>
            </div>
            
            <div className="bg-white p-8 rounded-xl shadow-sm">
              <Shield className="w-10 h-10 text-green-600 mb-4" />
              <h3 className="text-2xl font-bold mb-3 text-gray-900">Risk Detection</h3>
              <p className="text-gray-600">Identify potential legal risks and ambiguities in contracts before signing.</p>
            </div>
            
            <div className="bg-white p-8 rounded-xl shadow-sm">
              <GitCompare className="w-10 h-10 text-green-600 mb-4" />
              <h3 className="text-2xl font-bold mb-3 text-gray-900">Redlining & Comparison</h3>
              <p className="text-gray-600">Compare document versions to identify additions, deletions, and modifications.</p>
            </div>
          </div>
          
          <Link href="/register">
            <Button className="bg-green-600 hover:bg-green-700 text-lg py-6 px-8">
              Try Contract Automation <ArrowRight className="ml-2" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Compliance Auditing Section */}
      <section className="min-h-screen flex flex-col justify-center py-32 bg-white relative">
        <div className="container mx-auto max-w-6xl px-4">
          <div className="mb-4 text-green-600">Compliance Auditing</div>
          <h2 className="text-6xl font-bold mb-8 text-gray-900">
            Rapid Compliance, <br/>Grounded Results
          </h2>
          <p className="text-xl text-gray-600 mb-12 max-w-2xl">
            Get instant compliance analysis across multiple domains in legal, regulatory, and tax with accurate citations.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
            <div className="bg-green-50 p-8 rounded-xl border border-green-100 shadow-sm">
              <Shield className="w-10 h-10 text-green-600 mb-4" />
              <h3 className="text-2xl font-bold mb-3 text-gray-900">Regulatory Checks</h3>
              <p className="text-gray-600">Verify compliance with industry-specific regulations and standards.</p>
            </div>
            
            <div className="bg-green-50 p-8 rounded-xl border border-green-100 shadow-sm">
              <BarChart2 className="w-10 h-10 text-green-600 mb-4" />
              <h3 className="text-2xl font-bold mb-3 text-gray-900">Risk Assessment</h3>
              <p className="text-gray-600">Quantify legal and compliance risks with detailed analytics.</p>
            </div>
            
            <div className="bg-green-50 p-8 rounded-xl border border-green-100 shadow-sm">
              <FileSearch className="w-10 h-10 text-green-600 mb-4" />
              <h3 className="text-2xl font-bold mb-3 text-gray-900">Automated Auditing</h3>
              <p className="text-gray-600">Conduct thorough audits of documents and contracts automatically.</p>
            </div>
          </div>
          
          <Link href="/register">
            <Button className="bg-green-600 hover:bg-green-700 text-lg py-6 px-8">
              Try Compliance Auditing <ArrowRight className="ml-2" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Legal Research Section */}
      <section className="min-h-screen flex flex-col justify-center py-32 bg-gradient-to-br from-yellow-50 to-green-50 relative">
        <div className="container mx-auto max-w-6xl px-4">
          <div className="mb-4 text-green-600">Legal Research & Summarization</div>
          <h2 className="text-6xl font-bold mb-8 text-gray-900">
            Your AI Research <br/>Assistant
          </h2>
          <p className="text-xl text-gray-600 mb-12 max-w-2xl">
            Analyze vast legal databases, extract relevant precedents, and get instant summaries of complex case law for quick decision-making.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
            <div className="bg-white p-8 rounded-xl shadow-sm">
              <Book className="w-10 h-10 text-green-600 mb-4" />
              <h3 className="text-2xl font-bold mb-3 text-gray-900">Case Law Research</h3>
              <p className="text-gray-600">Find relevant precedents and legal opinions quickly for your cases.</p>
            </div>
            
            <div className="bg-white p-8 rounded-xl shadow-sm">
              <Brain className="w-10 h-10 text-green-600 mb-4" />
              <h3 className="text-2xl font-bold mb-3 text-gray-900">AI-Powered Summarization</h3>
              <p className="text-gray-600">Generate concise summaries of lengthy legal documents in seconds.</p>
            </div>
            
            <div className="bg-white p-8 rounded-xl shadow-sm">
              <FileSearch className="w-10 h-10 text-green-600 mb-4" />
              <h3 className="text-2xl font-bold mb-3 text-gray-900">Citation Analysis</h3>
              <p className="text-gray-600">Track and analyze legal citations to strengthen your arguments.</p>
            </div>
          </div>
          
          <Link href="/register">
            <Button className="bg-green-600 hover:bg-green-700 text-lg py-6 px-8">
              Try Legal Research <ArrowRight className="ml-2" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Call To Action */}
      <section className="py-24 bg-white">
        <div className="container mx-auto max-w-6xl px-4 text-center">
          <h2 className="text-5xl font-bold mb-6 text-gray-900">Ready to Transform Your Legal Practice?</h2>
          <p className="text-xl text-gray-600 mb-10 max-w-3xl mx-auto">
            Join thousands of legal professionals who are saving time, reducing errors, and delivering better results with JurySync.
          </p>
          <Link href="/register">
            <Button className="bg-green-600 hover:bg-green-700 text-lg py-8 px-10">
              Start Your 1-Day Free Trial Today <ArrowRight className="ml-2" />
            </Button>
          </Link>
          <p className="text-gray-500 mt-6">No credit card required • Unlimited access for 1 day</p>
        </div>
      </section>
    </div>
  );
}
