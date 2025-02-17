import { TemplateCategory } from "@shared/schema";

export const templateCategories = [
  {
    id: "1",
    name: "Employment",
    description: "Employment-related contracts and agreements",
    icon: "briefcase",
    templates: [
      {
        id: "emp-1",
        name: "Standard Employment Agreement",
        category: "EMPLOYMENT",
        description: "A comprehensive employment agreement for full-time employees",
        baseContent: "This Employment Agreement (the \"Agreement\") is made and entered into on [DATE] by and between [COMPANY_NAME] and [EMPLOYEE_NAME]...",
        variables: [
          { name: "employeeName", description: "Full name of the employee", required: true },
          { name: "position", description: "Job title or position", required: true },
          { name: "startDate", description: "Employment start date", required: true },
          { name: "salary", description: "Annual salary amount", required: true }
        ],
        metadata: {
          complexity: "MEDIUM",
          estimatedTime: "30-45 min",
          industry: "All",
          popularityScore: 95
        }
      },
      {
        id: "emp-2",
        name: "Executive Employment Agreement",
        category: "EMPLOYMENT",
        description: "Specialized agreement for C-level and executive positions",
        baseContent: "This Executive Employment Agreement (the \"Agreement\") is made and entered into on [DATE] between [COMPANY_NAME] and [EXECUTIVE_NAME]...",
        variables: [
          { name: "executiveName", description: "Full name of the executive", required: true },
          { name: "position", description: "Executive position/title", required: true },
          { name: "compensation", description: "Complete compensation package", required: true }
        ],
        metadata: {
          complexity: "HIGH",
          estimatedTime: "45-60 min",
          industry: "All",
          popularityScore: 85
        }
      },
      {
        id: "emp-3",
        name: "Remote Work Agreement",
        category: "EMPLOYMENT",
        description: "Agreement for remote work arrangements",
        baseContent: "This Remote Work Agreement outlines the terms and conditions for remote work...",
        variables: [
          { name: "employeeName", description: "Employee's full name", required: true },
          { name: "workSchedule", description: "Agreed work schedule", required: true },
          { name: "equipment", description: "Provided equipment details", required: true }
        ],
        metadata: {
          complexity: "LOW",
          estimatedTime: "20-30 min",
          industry: "All",
          popularityScore: 90
        }
      }
    ]
  },
  {
    id: "2",
    name: "Non-Disclosure Agreements",
    description: "Confidentiality and non-disclosure agreements",
    icon: "shield",
    templates: [
      {
        id: "nda-1",
        name: "Mutual NDA",
        category: "NDA",
        description: "Bilateral confidentiality agreement between two parties",
        baseContent: "This Mutual Non-Disclosure Agreement (the \"Agreement\") is entered into as of [DATE] between [PARTY_A] and [PARTY_B]...",
        variables: [
          { name: "partyAName", description: "Name of first party", required: true },
          { name: "partyBName", description: "Name of second party", required: true },
          { name: "purpose", description: "Purpose of information sharing", required: true }
        ],
        metadata: {
          complexity: "LOW",
          estimatedTime: "15-20 min",
          industry: "All",
          popularityScore: 100
        }
      },
      {
        id: "nda-2",
        name: "One-Way NDA",
        category: "NDA",
        description: "Unilateral confidentiality agreement protecting one party's information",
        baseContent: "This Non-Disclosure Agreement (\"Agreement\") is made between [DISCLOSING_PARTY] and [RECEIVING_PARTY]...",
        variables: [
          { name: "disclosingParty", description: "Name of party sharing information", required: true },
          { name: "receivingParty", description: "Name of party receiving information", required: true }
        ],
        metadata: {
          complexity: "LOW",
          estimatedTime: "15-25 min",
          industry: "All",
          popularityScore: 95
        }
      }
    ]
  },
  {
    id: "3",
    name: "Software Agreements",
    description: "Software licensing and development agreements",
    icon: "code",
    templates: [
      {
        id: "soft-1",
        name: "Software License Agreement",
        category: "SOFTWARE_LICENSE",
        description: "Standard software licensing agreement",
        baseContent: "This Software License Agreement (\"License\") is between [LICENSOR] and [LICENSEE]...",
        variables: [
          { name: "licensorName", description: "Name of software owner", required: true },
          { name: "licenseeName", description: "Name of software user", required: true },
          { name: "softwareName", description: "Name of software product", required: true }
        ],
        metadata: {
          complexity: "MEDIUM",
          estimatedTime: "30-45 min",
          industry: "Technology",
          popularityScore: 88
        }
      },
      {
        id: "soft-2",
        name: "Software Development Agreement",
        category: "SOFTWARE_LICENSE",
        description: "Contract for custom software development services",
        baseContent: "This Software Development Agreement is made between [DEVELOPER] and [CLIENT]...",
        variables: [
          { name: "developerName", description: "Name of development company", required: true },
          { name: "clientName", description: "Name of client", required: true },
          { name: "projectScope", description: "Detailed project scope", required: true }
        ],
        metadata: {
          complexity: "HIGH",
          estimatedTime: "45-60 min",
          industry: "Technology",
          popularityScore: 85
        }
      }
    ]
  },
  {
    id: "4",
    name: "Service Agreements",
    description: "Professional and consulting service agreements",
    icon: "handshake",
    templates: [
      {
        id: "serv-1",
        name: "Professional Services Agreement",
        category: "SERVICE_AGREEMENT",
        description: "Standard agreement for professional service providers",
        baseContent: "This Professional Services Agreement is made between [SERVICE_PROVIDER] and [CLIENT]...",
        variables: [
          { name: "providerName", description: "Name of service provider", required: true },
          { name: "clientName", description: "Name of client", required: true },
          { name: "serviceDescription", description: "Detailed description of services", required: true }
        ],
        metadata: {
          complexity: "MEDIUM",
          estimatedTime: "30-45 min",
          industry: "Professional Services",
          popularityScore: 90
        }
      }
    ]
  },
  {
    id: "5",
    name: "Real Estate",
    description: "Real estate contracts and agreements",
    icon: "home",
    templates: [
      {
        id: "re-1",
        name: "Commercial Lease Agreement",
        category: "REAL_ESTATE",
        description: "Comprehensive commercial property lease",
        baseContent: "This Commercial Lease Agreement (\"Lease\") is made between [LANDLORD] and [TENANT]...",
        variables: [
          { name: "landlordName", description: "Property owner's name", required: true },
          { name: "tenantName", description: "Business tenant's name", required: true },
          { name: "propertyAddress", description: "Complete property address", required: true },
          { name: "leaseTerm", description: "Duration of lease", required: true }
        ],
        metadata: {
          complexity: "HIGH",
          estimatedTime: "45-60 min",
          industry: "Real Estate",
          popularityScore: 92
        }
      }
    ]
  },
  {
    id: "6",
    name: "Partnership Agreements",
    description: "Partnership and collaboration agreements",
    icon: "handshake",
    templates: [
      {
        id: "part-1",
        name: "General Partnership Agreement",
        category: "PARTNERSHIP",
        description: "Standard partnership agreement for business ventures",
        baseContent: "This Partnership Agreement is made between [PARTNER_A] and [PARTNER_B]...",
        variables: [
          { name: "partnerAName", description: "First partner's name", required: true },
          { name: "partnerBName", description: "Second partner's name", required: true },
          { name: "businessName", description: "Partnership business name", required: true },
          { name: "profitSharing", description: "Profit sharing arrangement", required: true }
        ],
        metadata: {
          complexity: "HIGH",
          estimatedTime: "45-60 min",
          industry: "Business",
          popularityScore: 88
        }
      },
      {
        id: "part-2",
        name: "Limited Partnership Agreement",
        category: "PARTNERSHIP",
        description: "Agreement for limited partnership structure",
        baseContent: "This Limited Partnership Agreement is entered into by [GENERAL_PARTNER] and [LIMITED_PARTNER]...",
        variables: [
          { name: "generalPartner", description: "General partner details", required: true },
          { name: "limitedPartner", description: "Limited partner details", required: true },
          { name: "capitalContribution", description: "Initial capital contributions", required: true }
        ],
        metadata: {
          complexity: "HIGH",
          estimatedTime: "50-65 min",
          industry: "Business",
          popularityScore: 85
        }
      }
    ]
  },
  {
    id: "7",
    name: "Intellectual Property",
    description: "IP rights and licensing agreements",
    icon: "copyright",
    templates: [
      {
        id: "ip-1",
        name: "Patent License Agreement",
        category: "IP_LICENSE",
        description: "License agreement for patent rights",
        baseContent: "This Patent License Agreement is made between [LICENSOR] and [LICENSEE]...",
        variables: [
          { name: "licensorName", description: "Patent owner's name", required: true },
          { name: "licenseeName", description: "Licensee's name", required: true },
          { name: "patentNumbers", description: "Licensed patent numbers", required: true },
          { name: "royaltyTerms", description: "Royalty payment terms", required: true }
        ],
        metadata: {
          complexity: "HIGH",
          estimatedTime: "60-75 min",
          industry: "Technology",
          popularityScore: 82
        }
      },
      {
        id: "ip-2",
        name: "Trademark License Agreement",
        category: "IP_LICENSE",
        description: "License agreement for trademark usage",
        baseContent: "This Trademark License Agreement grants [LICENSEE] the right to use [TRADEMARK]...",
        variables: [
          { name: "trademarkOwner", description: "Trademark owner's name", required: true },
          { name: "licensee", description: "Licensee's name", required: true },
          { name: "trademarkDetails", description: "Licensed trademark details", required: true }
        ],
        metadata: {
          complexity: "MEDIUM",
          estimatedTime: "40-55 min",
          industry: "All",
          popularityScore: 86
        }
      }
    ]
  },
  {
    id: "8",
    name: "Financial Agreements",
    description: "Loan and financial contracts",
    icon: "dollar-sign",
    templates: [
      {
        id: "fin-1",
        name: "Term Loan Agreement",
        category: "LOAN_AGREEMENT",
        description: "Standard term loan contract",
        baseContent: "This Term Loan Agreement is made between [LENDER] and [BORROWER]...",
        variables: [
          { name: "lenderName", description: "Lender's name", required: true },
          { name: "borrowerName", description: "Borrower's name", required: true },
          { name: "loanAmount", description: "Principal loan amount", required: true },
          { name: "interestRate", description: "Annual interest rate", required: true },
          { name: "loanTerm", description: "Duration of the loan", required: true }
        ],
        metadata: {
          complexity: "HIGH",
          estimatedTime: "45-60 min",
          industry: "Finance",
          popularityScore: 90
        }
      },
      {
        id: "fin-2",
        name: "Line of Credit Agreement",
        category: "LOAN_AGREEMENT",
        description: "Revolving credit facility agreement",
        baseContent: "This Line of Credit Agreement establishes a credit facility between [LENDER] and [BORROWER]...",
        variables: [
          { name: "lenderName", description: "Lender's name", required: true },
          { name: "borrowerName", description: "Borrower's name", required: true },
          { name: "creditLimit", description: "Maximum credit limit", required: true },
          { name: "interestRate", description: "Annual interest rate", required: true }
        ],
        metadata: {
          complexity: "HIGH",
          estimatedTime: "50-65 min",
          industry: "Finance",
          popularityScore: 85
        }
      }
    ]
  },
  {
    id: "9",
    name: "Manufacturing",
    description: "Manufacturing and supply agreements",
    icon: "tool",
    templates: [
      {
        id: "mfg-1",
        name: "Manufacturing Agreement",
        category: "MANUFACTURING_AGREEMENT",
        description: "Contract for manufacturing goods",
        baseContent: "This Manufacturing Agreement is made between [MANUFACTURER] and [CUSTOMER]...",
        variables: [
          { name: "manufacturerName", description: "Manufacturer's name", required: true },
          { name: "customerName", description: "Customer's name", required: true },
          { name: "productSpecs", description: "Product specifications", required: true },
          { name: "quantity", description: "Production quantity", required: true },
          { name: "deliveryTerms", description: "Delivery schedule and terms", required: true }
        ],
        metadata: {
          complexity: "HIGH",
          estimatedTime: "55-70 min",
          industry: "Manufacturing",
          popularityScore: 84
        }
      },
      {
        id: "mfg-2",
        name: "Supply Agreement",
        category: "MANUFACTURING_AGREEMENT",
        description: "Long-term supply contract",
        baseContent: "This Supply Agreement governs the supply of [PRODUCTS] between [SUPPLIER] and [BUYER]...",
        variables: [
          { name: "supplierName", description: "Supplier's name", required: true },
          { name: "buyerName", description: "Buyer's name", required: true },
          { name: "productList", description: "List of products", required: true },
          { name: "pricingTerms", description: "Pricing and payment terms", required: true }
        ],
        metadata: {
          complexity: "HIGH",
          estimatedTime: "50-65 min",
          industry: "Manufacturing",
          popularityScore: 86
        }
      }
    ]
  },
  {
    id: "10",
    name: "Distribution Agreements",
    description: "Product distribution and reseller agreements",
    icon: "truck",
    templates: [
      {
        id: "dist-1",
        name: "Exclusive Distribution Agreement",
        category: "DISTRIBUTION_AGREEMENT",
        description: "Exclusive product distribution rights",
        baseContent: "This Exclusive Distribution Agreement grants [DISTRIBUTOR] the exclusive right to distribute [PRODUCTS]...",
        variables: [
          { name: "manufacturerName", description: "Manufacturer's name", required: true },
          { name: "distributorName", description: "Distributor's name", required: true },
          { name: "territory", description: "Exclusive territory", required: true },
          { name: "productList", description: "Products covered", required: true }
        ],
        metadata: {
          complexity: "HIGH",
          estimatedTime: "45-60 min",
          industry: "Retail",
          popularityScore: 87
        }
      },
      {
        id: "dist-2",
        name: "Reseller Agreement",
        category: "DISTRIBUTION_AGREEMENT",
        description: "Product resale authorization agreement",
        baseContent: "This Reseller Agreement authorizes [RESELLER] to resell [MANUFACTURER]'s products...",
        variables: [
          { name: "manufacturerName", description: "Manufacturer's name", required: true },
          { name: "resellerName", description: "Reseller's name", required: true },
          { name: "productList", description: "Authorized products", required: true },
          { name: "pricingTerms", description: "Pricing and commission structure", required: true }
        ],
        metadata: {
          complexity: "MEDIUM",
          estimatedTime: "35-50 min",
          industry: "Retail",
          popularityScore: 85
        }
      }
    ]
  },
  {
    id: "11",
    name: "Privacy and Data Protection",
    description: "Privacy policies and data protection agreements",
    icon: "shield-lock",
    templates: [
      {
        id: "priv-1",
        name: "Privacy Policy Agreement",
        category: "PRIVACY_POLICY",
        description: "Comprehensive privacy policy for websites and applications",
        baseContent: "This Privacy Policy describes how [COMPANY_NAME] collects, uses, and protects your personal information...",
        variables: [
          { name: "companyName", description: "Company's legal name", required: true },
          { name: "websiteUrl", description: "Website or application URL", required: true },
          { name: "contactEmail", description: "Privacy contact email", required: true }
        ],
        metadata: {
          complexity: "HIGH",
          estimatedTime: "40-55 min",
          industry: "Technology",
          popularityScore: 95
        }
      },
      {
        id: "priv-2",
        name: "Data Processing Agreement",
        category: "DATA_PROCESSING",
        description: "Agreement for GDPR-compliant data processing",
        baseContent: "This Data Processing Agreement is made between [CONTROLLER] and [PROCESSOR]...",
        variables: [
          { name: "controllerName", description: "Data controller's name", required: true },
          { name: "processorName", description: "Data processor's name", required: true },
          { name: "processingPurpose", description: "Purpose of data processing", required: true }
        ],
        metadata: {
          complexity: "HIGH",
          estimatedTime: "50-65 min",
          industry: "Technology",
          popularityScore: 88
        }
      }
    ]
  },
  {
    id: "12",
    name: "Subscription Services",
    description: "Subscription and recurring service agreements",
    icon: "repeat",
    templates: [
      {
        id: "sub-1",
        name: "SaaS Subscription Agreement",
        category: "SUBSCRIPTION_AGREEMENT",
        description: "Software as a Service subscription contract",
        baseContent: "This SaaS Subscription Agreement outlines the terms between [PROVIDER] and [SUBSCRIBER]...",
        variables: [
          { name: "providerName", description: "Service provider's name", required: true },
          { name: "subscriberName", description: "Subscriber's name", required: true },
          { name: "serviceName", description: "Name of the SaaS service", required: true },
          { name: "subscriptionTerm", description: "Subscription duration", required: true }
        ],
        metadata: {
          complexity: "HIGH",
          estimatedTime: "45-60 min",
          industry: "Technology",
          popularityScore: 92
        }
      },
      {
        id: "sub-2",
        name: "Content Subscription Agreement",
        category: "SUBSCRIPTION_AGREEMENT",
        description: "Digital content subscription service agreement",
        baseContent: "This Content Subscription Agreement is between [CONTENT_PROVIDER] and [SUBSCRIBER]...",
        variables: [
          { name: "providerName", description: "Content provider's name", required: true },
          { name: "subscriberName", description: "Subscriber's name", required: true },
          { name: "contentType", description: "Type of content provided", required: true }
        ],
        metadata: {
          complexity: "MEDIUM",
          estimatedTime: "30-45 min",
          industry: "Media",
          popularityScore: 85
        }
      }
    ]
  },
  {
    id: "13",
    name: "Corporate Governance",
    description: "Corporate governance and shareholder agreements",
    icon: "building",
    templates: [
      {
        id: "corp-1",
        name: "Shareholders Agreement",
        category: "SHAREHOLDERS_AGREEMENT",
        description: "Comprehensive shareholders rights and obligations agreement",
        baseContent: "This Shareholders Agreement is made between [COMPANY_NAME] and its shareholders...",
        variables: [
          { name: "companyName", description: "Company's legal name", required: true },
          { name: "shareholders", description: "List of shareholders", required: true },
          { name: "shareClasses", description: "Classes of shares", required: true }
        ],
        metadata: {
          complexity: "HIGH",
          estimatedTime: "60-75 min",
          industry: "Corporate",
          popularityScore: 88
        }
      },
      {
        id: "corp-2",
        name: "Board Resolution",
        category: "CORPORATE_GOVERNANCE",
        description: "Standard board of directors resolution",
        baseContent: "RESOLVED, that the Board of Directors of [COMPANY_NAME] hereby...",
        variables: [
          { name: "companyName", description: "Company's legal name", required: true },
          { name: "resolutionDate", description: "Date of resolution", required: true },
          { name: "resolutionPurpose", description: "Purpose of resolution", required: true }
        ],
        metadata: {
          complexity: "MEDIUM",
          estimatedTime: "25-40 min",
          industry: "Corporate",
          popularityScore: 85
        }
      }
    ]
  },
  {
    id: "14",
    name: "Mergers and Acquisitions",
    description: "M&A related agreements and documents",
    icon: "git-merge",
    templates: [
      {
        id: "ma-1",
        name: "Asset Purchase Agreement",
        category: "MERGER_ACQUISITION",
        description: "Agreement for the purchase of business assets",
        baseContent: "This Asset Purchase Agreement is made between [SELLER] and [BUYER]...",
        variables: [
          { name: "sellerName", description: "Seller's legal name", required: true },
          { name: "buyerName", description: "Buyer's legal name", required: true },
          { name: "assetsList", description: "List of assets being purchased", required: true },
          { name: "purchasePrice", description: "Total purchase price", required: true }
        ],
        metadata: {
          complexity: "HIGH",
          estimatedTime: "70-85 min",
          industry: "Corporate",
          popularityScore: 86
        }
      },
      {
        id: "ma-2",
        name: "Stock Purchase Agreement",
        category: "MERGER_ACQUISITION",
        description: "Agreement for the purchase of company stock",
        baseContent: "This Stock Purchase Agreement is entered into by [SELLER] and [PURCHASER]...",
        variables: [
          { name: "sellerName", description: "Seller's name", required: true },
          { name: "purchaserName", description: "Purchaser's name", required: true },
          { name: "stockDetails", description: "Details of stock being sold", required: true }
        ],
        metadata: {
          complexity: "HIGH",
          estimatedTime: "65-80 min",
          industry: "Corporate",
          popularityScore: 87
        }
      }
    ]
  },
  {
    id: "15",
    name: "Franchise Agreements",
    description: "Franchise and business opportunity agreements",
    icon: "store",
    templates: [
      {
        id: "fran-1",
        name: "Franchise Agreement",
        category: "FRANCHISE_AGREEMENT",
        description: "Master franchise agreement",
        baseContent: "This Franchise Agreement is made between [FRANCHISOR] and [FRANCHISEE]...",
        variables: [
          { name: "franchisorName", description: "Franchisor's legal name", required: true },
          { name: "franchiseeName", description: "Franchisee's legal name", required: true },
          { name: "territory", description: "Franchise territory", required: true },
          { name: "royaltyRate", description: "Royalty percentage", required: true }
        ],
        metadata: {
          complexity: "HIGH",
          estimatedTime: "55-70 min",
          industry: "Retail",
          popularityScore: 89
        }
      },
      {
        id: "fran-2",
        name: "Area Development Agreement",
        category: "FRANCHISE_AGREEMENT",
        description: "Multi-unit franchise development agreement",
        baseContent: "This Area Development Agreement grants [DEVELOPER] the right to develop...",
        variables: [
          { name: "developerName", description: "Developer's name", required: true },
          { name: "brandName", description: "Franchise brand name", required: true },
          { name: "developmentSchedule", description: "Unit development timeline", required: true }
        ],
        metadata: {
          complexity: "HIGH",
          estimatedTime: "50-65 min",
          industry: "Retail",
          popularityScore: 84
        }
      }
    ]
  },
  {
    id: "16",
    name: "Joint Ventures",
    description: "Joint venture and collaboration agreements",
    icon: "users",
    templates: [
      {
        id: "jv-1",
        name: "Joint Venture Agreement",
        category: "JOINT_VENTURE",
        description: "Comprehensive joint venture agreement",
        baseContent: "This Joint Venture Agreement is made between [PARTY_A] and [PARTY_B]...",
        variables: [
          { name: "partyAName", description: "First party's legal name", required: true },
          { name: "partyBName", description: "Second party's legal name", required: true },
          { name: "jvPurpose", description: "Purpose of joint venture", required: true },
          { name: "profitSharing", description: "Profit sharing ratio", required: true }
        ],
        metadata: {
          complexity: "HIGH",
          estimatedTime: "55-70 min",
          industry: "Business",
          popularityScore: 87
        }
      },
      {
        id: "jv-2",
        name: "Strategic Alliance Agreement",
        category: "JOINT_VENTURE",
        description: "Strategic business alliance agreement",
        baseContent: "This Strategic Alliance Agreement outlines the collaboration between [PARTY_A] and [PARTY_B]...",
        variables: [
          { name: "partyAName", description: "First party's name", required: true },
          { name: "partyBName", description: "Second party's name", required: true },
          { name: "allianceScope", description: "Scope of alliance", required: true }
        ],
        metadata: {
          complexity: "MEDIUM",
          estimatedTime: "40-55 min",
          industry: "Business",
          popularityScore: 85
        }
      }
    ]
  },
  {
    id: "17",
    name: "Warranties",
    description: "Warranty and guarantee agreements",
    icon: "check-square",
    templates: [
      {
        id: "warr-1",
        name: "Product Warranty Agreement",
        category: "WARRANTY_AGREEMENT",
        description: "Standard product warranty terms",
        baseContent: "This Product Warranty Agreement provided by [MANUFACTURER] to [CUSTOMER]...",
        variables: [
          { name: "manufacturerName", description: "Manufacturer's name", required: true },
          { name: "productName", description: "Product name/model", required: true },
          { name: "warrantyTerm", description: "Warranty duration", required: true },
          { name: "coverage", description: "Warranty coverage details", required: true }
        ],
        metadata: {
          complexity: "MEDIUM",
          estimatedTime: "35-50 min",
          industry: "Manufacturing",
          popularityScore: 86
        }
      },
      {
        id: "warr-2",
        name: "Extended Warranty Agreement",
        category: "WARRANTY_AGREEMENT",
        description: "Extended warranty service contract",
        baseContent: "This Extended Warranty Agreement extends coverage for [PRODUCT]...",
        variables: [
          { name: "providerName", description: "Warranty provider's name", required: true },
          { name: "customerName", description: "Customer's name", required: true },
          { name: "productDetails", description: "Product information", required: true }
        ],
        metadata: {
          complexity: "MEDIUM",
          estimatedTime: "30-45 min",
          industry: "Retail",
          popularityScore: 84
        }
      }
    ]
  },
  {
    id: "18",
    name: "Website Legal",
    description: "Website legal documents and policies",
    icon: "globe",
    templates: [
      {
        id: "web-1",
        name: "Terms of Service",
        category: "TERMS_OF_SERVICE",
        description: "Website terms of service agreement",
        baseContent: "These Terms of Service govern your use of [WEBSITE_NAME]...",
        variables: [
          { name: "websiteName", description: "Website name", required: true },
          { name: "companyName", description: "Company's legal name", required: true },
          { name: "contactEmail", description: "Contact email", required: true }
        ],
        metadata: {
          complexity: "MEDIUM",
          estimatedTime: "35-50 min",
          industry: "Technology",
          popularityScore: 94
        }
      },
      {
        id: "web-2",
        name: "Cookie Policy",
        category: "PRIVACY_POLICY",
        description: "Website cookie usage policy",
        baseContent: "This Cookie Policy explains how [WEBSITE_NAME] uses cookies and similar technologies...",
        variables: [
          { name: "websiteName", description: "Website name", required: true },
          { name: "companyName", description: "Company's legal name", required: true }
        ],
        metadata: {
          complexity: "LOW",
          estimatedTime: "25-40 min",
          industry: "Technology",
          popularityScore: 88
        }
      }
    ]
  },
  {
    id: "19",
    name: "Construction",
    description: "Construction and contractor agreements",
    icon: "tool",
    templates: [
      {
        id: "const-1",
        name: "General Contractor Agreement",
        category: "CONTRACTOR_AGREEMENT",
        description: "Agreement for general contracting services",
        baseContent: "This General Contractor Agreement is made between [OWNER] and [CONTRACTOR]...",
        variables: [
          { name: "ownerName", description: "Property owner's name", required: true },
          { name: "contractorName", description: "Contractor's name", required: true },
          { name: "projectScope", description: "Project scope of work", required: true },
          { name: "projectTimeline", description: "Project timeline", required: true }
        ],
        metadata: {
          complexity: "HIGH",
          estimatedTime: "50-65 min",
          industry: "Construction",
          popularityScore: 89
        }
      },
      {
        id: "const-2",
        name: "Subcontractor Agreement",
        category: "CONTRACTOR_AGREEMENT",
        description: "Agreement between contractor and subcontractor",
        baseContent: "This Subcontractor Agreement is between [CONTRACTOR] and [SUBCONTRACTOR]...",
        variables: [
          { name: "contractorName", description: "Main contractor's name", required: true },
          { name: "subcontractorName", description: "Subcontractor's name", required: true },
          { name: "workScope", description: "Scope of subcontracted work", required: true }
        ],
        metadata: {
          complexity: "MEDIUM",
          estimatedTime: "40-55 min",
          industry: "Construction",
          popularityScore: 86
        }
      }
    ]
  },{
    id: "20",
    name: "Consulting",
    description: "Consulting and advisory agreements",
    icon: "briefcase",
    templates: [
      {
        id: "cons-1",
        name: "Management Consulting Agreement",
        category: "CONSULTING",
        description: "Professional management consulting services",
        baseContent: "This Management Consulting Agreement is between [CONSULTANT] and [CLIENT]...",
        variables: [
          { name: "consultantName", description: "Consultant's name", required: true },
          { name: "clientName", description: "Client's name", required: true },
          { name: "servicesScope", description: "Scope of consulting services", required: true },
          { name: "compensation", description: "Compensation terms", required: true }
        ],
        metadata: {
          complexity: "HIGH",
          estimatedTime: "45-60 min",
          industry: "Consulting",
          popularityScore: 91
        }
      },
      {
        id: "cons-2",
        name: "Technical Consulting Agreement",
        category: "CONSULTING",
        description: "Technical consulting services agreement",
        baseContent: "This Technical Consulting Agreement outlines the terms between [CONSULTANT] and [CLIENT]...",
        variables: [
          { name: "consultantName", description: "Technical consultant's name", required: true },
          { name: "clientName", description: "Client's name", required: true },
          { name: "technicalScope", description: "Technical services scope", required: true }
        ],
        metadata: {
          complexity: "MEDIUM",
          estimatedTime: "35-50 min",
          industry: "Technology",
          popularityScore: 88
        }
      }
    ]
  },
  {
    id: "21",
    name: "Healthcare",
    description: "Healthcare-related agreements",
    icon: "heart",
    templates: [
      {
        id: "health-1",
        name: "HIPAA Business Associate Agreement",
        category: "DATA_PROCESSING",
        description: "HIPAA compliance agreement for healthcare data",
        baseContent: "This Business Associate Agreement is made pursuant to HIPAA between [COVERED_ENTITY] and [BUSINESS_ASSOCIATE]...",
        variables: [
          { name: "coveredEntityName", description: "Covered entity's name", required: true },
          { name: "businessAssociateName", description: "Business associate's name", required: true },
          { name: "services", description: "Services provided", required: true }
        ],
        metadata: {
          complexity: "HIGH",
          estimatedTime: "50-65 min",
          industry: "Healthcare",
          popularityScore: 89
        }
      },
      {
        id: "health-2",
        name: "Medical Services Agreement",
        category: "SERVICE_AGREEMENT",
        description: "Agreement for medical service provision",
        baseContent: "This Medical Services Agreement is between [PROVIDER] and [FACILITY]...",
        variables: [
          { name: "providerName", description: "Medical provider's name", required: true },
          { name: "facilityName", description: "Medical facility's name", required: true },
          { name: "serviceScope", description: "Scope of medical services", required: true }
        ],
        metadata: {
          complexity: "HIGH",
          estimatedTime: "45-60 min",
          industry: "Healthcare",
          popularityScore: 86
        }
      }
    ]
  },
  {
    id: "22",
    name: "Entertainment",
    description: "Entertainment and media agreements",
    icon: "film",
    templates: [
      {
        id: "ent-1",
        name: "Talent Agreement",
        category: "SERVICE_AGREEMENT",
        description: "Agreement for talent services",
        baseContent: "This Talent Agreement is made between [PRODUCER] and [TALENT]...",
        variables: [
          { name: "producerName", description: "Producer's name", required: true },
          { name: "talentName", description: "Talent's name", required: true },
          { name: "projectName", description: "Project name", required: true },
          { name: "compensation", description: "Compensation terms", required: true }
        ],
        metadata: {
          complexity: "MEDIUM",
          estimatedTime: "40-55 min",
          industry: "Entertainment",
          popularityScore: 85
        }
      },
      {
        id: "ent-2",
        name: "Content Licensing Agreement",
        category: "IP_LICENSE",
        description: "Content licensing and distribution agreement",
        baseContent: "This Content Licensing Agreement grants [LICENSEE] the right to distribute [CONTENT]...",
        variables: [
          { name: "licensorName", description: "Content owner's name", required: true },
          { name: "licenseeName", description: "Distributor's name", required: true },
          { name: "contentDescription", description: "Licensed content details", required: true }
        ],
        metadata: {
          complexity: "HIGH",
          estimatedTime: "45-60 min",
          industry: "Media",
          popularityScore: 87
        }
      }
    ]
  },
  {
    id: "23",
    name: "Education",
    description: "Educational institution agreements",
    icon: "book",
    templates: [
      {
        id: "edu-1",
        name: "Student Enrollment Agreement",
        category: "SERVICE_AGREEMENT",
        description: "Educational institution enrollment contract",
        baseContent: "This Enrollment Agreement is between [INSTITUTION] and [STUDENT]...",
        variables: [
          { name: "institutionName", description: "Institution's name", required: true },
          { name: "studentName", description: "Student's name", required: true },
          { name: "programDetails", description: "Program information", required: true },
          { name: "tuitionFees", description: "Tuition and fees", required: true }
        ],
        metadata: {
          complexity: "MEDIUM",
          estimatedTime: "35-50 min",
          industry: "Education",
          popularityScore: 88
        }
      },
      {
        id: "edu-2",
        name: "Educational Partnership Agreement",
        category: "PARTNERSHIP",
        description: "Partnership between educational institutions",
        baseContent: "This Educational Partnership Agreement facilitates collaboration between [INSTITUTION_A] and [INSTITUTION_B]...",
        variables: [
          { name: "institutionAName", description: "First institution's name", required: true },
          { name: "institutionBName", description: "Second institution's name", required: true },
          { name: "collaborationScope", description: "Scope of collaboration", required: true }
        ],
        metadata: {
          complexity: "HIGH",
          estimatedTime: "45-60 min",
          industry: "Education",
          popularityScore: 85
        }
      }
    ]
  },
  {
    id: "24",
    name: "E-commerce",
    description: "E-commerce related agreements",
    icon: "shopping-cart",
    templates: [
      {
        id: "ecom-1",
        name: "Marketplace Seller Agreement",
        category: "SERVICE_AGREEMENT",
        description: "Agreement for marketplace sellers",
        baseContent: "This Marketplace Seller Agreement is between [MARKETPLACE] and [SELLER]...",
        variables: [
          { name: "marketplaceName", description: "Marketplace name", required: true },
          { name: "sellerName", description: "Seller's name", required: true },
          { name: "commissionRate", description: "Commission rate", required: true }
        ],
        metadata: {
          complexity: "MEDIUM",
          estimatedTime: "35-50 min",
          industry: "E-commerce",
          popularityScore: 90
        }
      },
      {
        id: "ecom-2",
        name: "Drop Shipping Agreement",
        category: "SERVICE_AGREEMENT",
        description: "Drop shipping service agreement",
        baseContent: "This Drop Shipping Agreement outlines terms between [RETAILER] and [SUPPLIER]...",
        variables: [
          { name: "retailerName", description: "Retailer's name", required: true },
          { name: "supplierName", description: "Supplier's name", required: true },
          { name: "shippingTerms", description: "Shipping terms", required: true }
        ],
        metadata: {
          complexity: "MEDIUM",
          estimatedTime: "30-45 min",
          industry: "E-commerce",
          popularityScore: 87
        }
      }
    ]
  },
  {
    id: "25",
    name: "Transportation",
    description: "Transportation and logistics agreements",
    icon: "truck",
    templates: [
      {
        id: "trans-1",
        name: "Carrier Agreement",
        category: "SERVICE_AGREEMENT",
        description: "Transportation carrier service agreement",
        baseContent: "This Carrier Agreement is between [SHIPPER] and [CARRIER]...",
        variables: [
          { name: "shipperName", description: "Shipper's name", required: true },
          { name: "carrierName", description: "Carrier's name", required: true },
          { name: "serviceArea", description: "Service coverage area", required: true },
          { name: "rateSchedule", description: "Rate schedule", required: true }
        ],
        metadata: {
          complexity: "MEDIUM",
          estimatedTime: "40-55 min",
          industry: "Transportation",
          popularityScore: 86
        }
      },
      {
        id: "trans-2",
        name: "Logistics Services Agreement",
        category: "SERVICE_AGREEMENT",
        description: "Third-party logistics (3PL) agreement",
        baseContent: "This Logistics Services Agreement establishes terms between [CUSTOMER] and [PROVIDER]...",
        variables: [
          { name: "customerName", description: "Customer's name", required: true },
          { name: "providerName", description: "3PL provider's name", required: true },
          { name: "servicesScope", description: "Logistics services scope", required: true }
        ],
        metadata: {
          complexity: "HIGH",
          estimatedTime: "45-60 min",
          industry: "Transportation",
          popularityScore: 85
        }
      }
    ]
  }
];

// Function to generate and return the complete set of templates
export const generateTemplateData = () => {
  return templateCategories.reduce((acc, category) => {
    return [...acc, ...category.templates];
  }, [] as any[]);
};