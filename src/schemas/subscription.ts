import { z } from "zod";

export const createSubscriptionSchema = z.object({
  customer_email: z.string().email("Valid email required"),
  customer_name: z.string().optional(),
  plan_name: z.string().default("Monthly"),
  amount_paid: z.number().positive().optional(),
  payment_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD format"),
  duration_days: z.number().int().positive().default(30),
  notes: z.string().optional(),
});

export const updateSubscriptionSchema = createSubscriptionSchema
  .partial()
  .extend({
    status: z.enum(["active", "expired", "cancelled"]).optional(),
  });

export const renewSubscriptionSchema = z.object({
  payment_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD format"),
  amount_paid: z.number().positive().optional(),
  duration_days: z.number().int().positive().default(30),
});

export const emailQuerySchema = z.object({
  email: z.string().email("Valid email required"),
});

export const loginSchema = z.object({
  password: z.string().min(1, "Password required"),
});

export const setupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export type CreateSubscription = z.infer<typeof createSubscriptionSchema>;
export type UpdateSubscription = z.infer<typeof updateSubscriptionSchema>;
export type RenewSubscription = z.infer<typeof renewSubscriptionSchema>;
