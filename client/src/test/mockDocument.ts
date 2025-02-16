export const mockDocument = {
  content: `
    EMPLOYMENT AGREEMENT
    
    This Employment Agreement (the "Agreement") is made and entered into as of [DATE], by and between [COMPANY NAME], a technology corporation ("Employer"), and [EMPLOYEE NAME] ("Employee").
    
    1. Position and Duties
    Employee shall be employed as a Software Engineer, reporting to the Chief Technology Officer...
  `,
  metadata: {
    documentType: "Employment Agreement",
    industry: "Technology",
    complianceStatus: {
      status: "PASSED",
      score: 85,
      details: "Document meets all compliance requirements"
    }
  }
};

// Use this in development to test:
// localStorage.setItem('documentVault', JSON.stringify([mockDocument])); 