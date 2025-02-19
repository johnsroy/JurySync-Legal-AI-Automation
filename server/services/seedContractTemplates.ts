import { db } from '../db';
import { templateGenerator } from './template-generator';
import { TemplateCategory, TemplateCategoryEnum } from '@shared/schema/template-categories';
import { contractTemplates } from '@shared/schema';
import { sql } from 'drizzle-orm';

// Increased templates per category to 20
const TEMPLATES_PER_CATEGORY: Record<TemplateCategory, number> = {
  GENERAL: 20,
  EMPLOYMENT: 20,
  REAL_ESTATE: 20,
  BUSINESS: 20,
  INTELLECTUAL_PROPERTY: 20,
  SERVICE_AGREEMENT: 20,
  NDA: 20,
  LICENSING: 20,
  PARTNERSHIP: 20,
  CONSULTING: 20,
  MERGER_ACQUISITION: 20
};

// Enhanced specializations for more variety
const SPECIALIZATIONS: Record<TemplateCategory, string[]> = {
  EMPLOYMENT: [
    'Executive Employment', 'Entry-level Employment', 'Independent Contractor', 
    'Remote Work', 'Commission-based', 'Part-time Employment', 'Seasonal Employment',
    'Fixed-term Contract', 'Internship Agreement', 'Consulting Agreement',
    'Sales Representative', 'Management Position', 'Technical Position',
    'Professional Services', 'Healthcare Position', 'Education Position',
    'Retail Position', 'Manufacturing Position', 'Construction Position',
    'Hospitality Position'
  ],
  REAL_ESTATE: [
    'Commercial Lease', 'Residential Sale', 'Property Management', 'Construction', 
    'Development Agreement', 'Purchase Agreement', 'Lease-to-Own', 'Sublease',
    'Rental Agreement', 'Property Maintenance', 'Real Estate Investment',
    'Joint Venture Development', 'Land Use Agreement', 'Easement Agreement',
    'Property Transfer', 'Option to Purchase', 'Right of First Refusal',
    'Deed of Trust', 'Mortgage Agreement', 'Property Insurance'
  ],
  BUSINESS: [
    'Partnership Agreement', 'Joint Venture', 'Franchise Agreement', 'Distribution', 
    'Supply Chain', 'Manufacturing Agreement', 'Service Level Agreement',
    'Master Services Agreement', 'Vendor Agreement', 'Reseller Agreement',
    'Licensing Agreement', 'Marketing Agreement', 'Channel Partner Agreement',
    'Strategic Alliance', 'Affiliate Agreement', 'Agency Agreement',
    'Consulting Services', 'Outsourcing Agreement', 'Procurement Contract',
    'Business Sale Agreement'
  ],
  INTELLECTUAL_PROPERTY: [
    'Software License', 'Patent License', 'Trademark License', 'Copyright Transfer', 
    'Trade Secret', 'Technology Transfer', 'Research & Development',
    'Content License', 'Data Processing', 'IP Assignment',
    'Joint Development', 'Source Code License', 'Patent Assignment',
    'Brand License', 'Media Rights', 'Publishing Rights',
    'Distribution Rights', 'Manufacturing License', 'Technology License',
    'Service Mark License'
  ],
  SERVICE_AGREEMENT: [
    'IT Services', 'Consulting Services', 'Marketing Services', 'Maintenance', 
    'Professional Services', 'Cloud Services', 'Software Development',
    'Support Services', 'Training Services', 'Installation Services',
    'Managed Services', 'Security Services', 'Cleaning Services',
    'Logistics Services', 'Healthcare Services', 'Financial Services',
    'Legal Services', 'Engineering Services', 'Design Services',
    'Educational Services'
  ],
  NDA: [
    'Mutual NDA', 'Unilateral NDA', 'Employee NDA', 'Contractor NDA', 
    'Vendor NDA', 'Interview NDA', 'Project NDA', 'Investment NDA',
    'Research NDA', 'Development NDA', 'Partnership NDA', 'Sale NDA',
    'Acquisition NDA', 'Evaluation NDA', 'Consultant NDA', 'Collaboration NDA',
    'Beta Testing NDA', 'Trade Secret NDA', 'Technology NDA',
    'Joint Venture NDA'
  ],
  LICENSING: [
    'Software License', 'Technology License', 'Brand License', 'Content License', 
    'Patent License', 'Distribution License', 'Manufacturing License',
    'Service License', 'Data License', 'API License', 'Platform License',
    'Mobile App License', 'Game License', 'Music License', 'Video License',
    'Research License', 'Educational License', 'Commercial License',
    'Enterprise License', 'Developer License'
  ],
  PARTNERSHIP: [
    'General Partnership', 'Limited Partnership', 'Joint Venture Partnership', 
    'Strategic Alliance', 'Distribution Partnership', 'Channel Partnership',
    'Technology Partnership', 'Research Partnership', 'Marketing Partnership',
    'Sales Partnership', 'Service Partnership', 'Manufacturing Partnership',
    'Development Partnership', 'Investment Partnership', 'Franchise Partnership',
    'Agency Partnership', 'Consulting Partnership', 'Retail Partnership',
    'Supply Chain Partnership', 'International Partnership'
  ],
  CONSULTING: [
    'Technology Consulting', 'Management Consulting', 'Financial Consulting', 
    'Business Strategy', 'IT Consulting', 'Marketing Consulting',
    'HR Consulting', 'Operations Consulting', 'Legal Consulting',
    'Healthcare Consulting', 'Education Consulting', 'Engineering Consulting',
    'Environmental Consulting', 'Risk Management', 'Project Management',
    'Change Management', 'Digital Transformation', 'Process Improvement',
    'Quality Assurance', 'Regulatory Compliance'
  ],
  MERGER_ACQUISITION: [
    'Asset Purchase', 'Stock Purchase', 'Merger Agreement', 'Due Diligence', 
    'Post-Merger Integration', 'Joint Venture Formation', 'Acquisition Agreement',
    'Share Purchase', 'Business Combination', 'Corporate Restructuring',
    'Holdback Agreement', 'Earnout Agreement', 'Purchase Price Adjustment',
    'Transaction Services', 'Transition Services', 'Employee Retention',
    'IP Transfer', 'Asset Transfer', 'Liability Assignment',
    'Integration Planning'
  ],
  GENERAL: [
    'General Terms', 'Standard Agreement', 'Basic Contract', 'Framework Agreement', 
    'Master Agreement', 'Service Contract', 'Subscription Agreement',
    'Terms and Conditions', 'User Agreement', 'Customer Agreement',
    'Commercial Contract', 'Business Agreement', 'Operating Agreement',
    'Cooperation Agreement', 'Working Agreement', 'Project Agreement',
    'Engagement Terms', 'Standard Terms', 'Business Terms',
    'General Conditions'
  ]
};

export async function seedContractTemplates() {
  try {
    console.log("Checking existing contract templates...");

    // Check if templates already exist
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(contractTemplates);

    console.log(`Found ${count} existing templates`);

    if (count > 0) {
      console.log("Contract templates already seeded");
      return;
    }

    console.log("Starting contract template seeding...");

    const templates = [];
    const categories = Object.values(TemplateCategoryEnum.Values);

    for (const category of categories) {
      const numTemplates = TEMPLATES_PER_CATEGORY[category];
      const specializations = SPECIALIZATIONS[category] || [];

      console.log(`Generating ${numTemplates} templates for category ${category}`);

      for (let i = 0; i < numTemplates; i++) {
        try {
          const specialization = specializations[i % specializations.length];
          const template = await templateGenerator.generateTemplate(
            category,
            specialization
          );
          templates.push(template);
          console.log(`Generated template for ${category} (${i + 1}/${numTemplates})`);
        } catch (error) {
          console.error(`Failed to generate template for ${category}:`, error);
          continue;
        }
      }
    }

    if (templates.length === 0) {
      throw new Error("No templates were generated successfully");
    }

    // Insert templates in batches
    const batchSize = 20;
    for (let i = 0; i < templates.length; i += batchSize) {
      const batch = templates.slice(i, i + batchSize);
      await db.insert(contractTemplates).values(batch);
      console.log(`Inserted batch ${Math.floor(i/batchSize) + 1} of ${Math.ceil(templates.length/batchSize)}`);
    }

    // Verify insertion
    const [{ finalCount }] = await db
      .select({ finalCount: sql<number>`count(*)::int` })
      .from(contractTemplates);

    console.log(`Successfully seeded ${finalCount} contract templates`);
  } catch (error) {
    console.error("Error seeding contract templates:", error);
    throw error;
  }
}