import { createInsertSchema } from "drizzle-zod";
import { relations, pgTable, serial, text, decimal, timestamp, boolean } from "drizzle-orm/pg-core";
import { z } from "zod";
import { users } from "./users";

export const subscriptionPlans = pgTable('subscription_plans', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  priceMonthly: decimal('price_monthly', { precision: 10, scale: 2 }).notNull(),
  priceYearly: decimal('price_yearly', { precision: 10, scale: 2 }).notNull(),
  stripePriceIdMonthly: text('stripe_price_id_monthly').notNull(),
  stripePriceIdYearly: text('stripe_price_id_yearly').notNull(),
  features: text('features').array().notNull(),
  isStudent: boolean('is_student').default(false).notNull(),
  isEnterprise: boolean('is_enterprise').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const subscriptions = pgTable('subscriptions', {
  id: serial('id').primaryKey(),
  userId: serial('user_id').references(() => users.id).notNull(),
  planId: serial('plan_id').references(() => subscriptionPlans.id).notNull(),
  stripeCustomerId: text('stripe_customer_id').notNull(),
  stripeSubscriptionId: text('stripe_subscription_id').notNull(),
  status: text('status').notNull(),
  currentPeriodStart: timestamp('current_period_start').notNull(),
  currentPeriodEnd: timestamp('current_period_end').notNull(),
  cancelAtPeriodEnd: boolean('cancel_at_period_end').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const subscriptionRelations = relations(subscriptions, ({ one }) => ({
  user: one(users, {
    fields: [subscriptions.userId],
    references: [users.id],
  }),
  plan: one(subscriptionPlans, {
    fields: [subscriptions.planId],
    references: [subscriptionPlans.id],
  }),
}));

export const insertSubscriptionPlanSchema = createInsertSchema(subscriptionPlans);
export const insertSubscriptionSchema = createInsertSchema(subscriptions);

export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;
export type InsertSubscriptionPlan = typeof subscriptionPlans.$inferInsert;
export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = typeof subscriptions.$inferInsert;

// Zod schema for verifying student email
export const studentEmailSchema = z.object({
  email: z.string().email().refine((email) => email.endsWith('.edu'), {
    message: 'Must be a valid .edu email address',
  }),
});
