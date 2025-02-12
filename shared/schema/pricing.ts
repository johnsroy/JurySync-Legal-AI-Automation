import { z } from "zod";

export const PlanTier = {
  STUDENT: "student",
  PROFESSIONAL: "professional",
  ENTERPRISE: "enterprise",
} as const;

export type PlanTierId = typeof PlanTier[keyof typeof PlanTier];

export const planSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  price: z.number(),
  features: z.array(z.string()),
  priceId: z.string(), // Stripe price ID
  interval: z.enum(["month", "year"]),
  tier: z.enum([PlanTier.STUDENT, PlanTier.PROFESSIONAL, PlanTier.ENTERPRISE]),
});

export type Plan = z.infer<typeof planSchema>;

export const PRICING_PLANS: Plan[] = [
  {
    id: "student-monthly",
    name: "Student",
    description: "Perfect for students and academic research",
    price: 24,
    interval: "month",
    tier: PlanTier.STUDENT,
    priceId: "price_student_monthly", // We'll update this with actual Stripe price IDs
    features: [
      "Basic document analysis",
      "Limited API access",
      "Email support",
      "1-day free trial",
    ],
  },
  {
    id: "student-yearly",
    name: "Student",
    description: "Perfect for students and academic research",
    price: 240,
    interval: "year",
    tier: PlanTier.STUDENT,
    priceId: "price_student_yearly",
    features: [
      "Basic document analysis",
      "Limited API access",
      "Email support",
      "1-day free trial",
      "Save 17% with annual billing",
    ],
  },
  {
    id: "professional-monthly",
    name: "Professional",
    description: "For legal professionals and small firms",
    price: 194,
    interval: "month",
    tier: PlanTier.PROFESSIONAL,
    priceId: "price_professional_monthly",
    features: [
      "Advanced document analysis",
      "Unlimited API access",
      "Priority support",
      "Custom templates",
      "1-day free trial",
    ],
  },
  {
    id: "professional-yearly",
    name: "Professional",
    description: "For legal professionals and small firms",
    price: 1940,
    interval: "year",
    tier: PlanTier.PROFESSIONAL,
    priceId: "price_professional_yearly",
    features: [
      "Advanced document analysis",
      "Unlimited API access",
      "Priority support",
      "Custom templates",
      "1-day free trial",
      "Save 17% with annual billing",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    description: "For large organizations with custom needs",
    price: 0,
    interval: "month",
    tier: PlanTier.ENTERPRISE,
    priceId: "price_enterprise",
    features: [
      "Custom document analysis",
      "Dedicated API access",
      "24/7 priority support",
      "Custom integration",
      "Dedicated account manager",
      "Custom pricing",
    ],
  },
];
