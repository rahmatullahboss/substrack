import { z } from "zod";

export const orderItemSchema = z.object({
  description: z.string().min(1, "Item description required"),
  qty: z.number().positive("Quantity must be positive"),
  unit_price: z.number().nonnegative("Unit price must be non-negative"),
});

export const createOrderSchema = z.object({
  subscription_id: z.number().int().positive().optional(),
  customer_email: z.string().email("Valid email required"),
  customer_name: z.string().optional(),
  order_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")
    .optional(),
  items: z.array(orderItemSchema).min(1, "At least one item required"),
  tax_rate: z.number().nonnegative().max(100).default(0),
  discount: z.number().nonnegative().default(0),
  currency: z.string().length(3).default("USD"),
  payment_method: z.string().optional(),
  notes: z.string().optional(),
});

export const updateOrderSchema = createOrderSchema.partial().extend({
  status: z
    .enum(["pending", "paid", "cancelled", "refunded"])
    .optional(),
  payment_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")
    .optional(),
});

export const payOrderSchema = z.object({
  payment_method: z.string().optional(),
  payment_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")
    .optional(),
});

export const createInvoiceSchema = z.object({
  order_id: z.number().int().positive("Order ID required"),
  due_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")
    .optional(),
  notes: z.string().optional(),
});

export const updateInvoiceStatusSchema = z.object({
  status: z.enum(["draft", "sent", "paid", "overdue", "cancelled"]),
});

export type OrderItem = z.infer<typeof orderItemSchema>;
export type CreateOrder = z.infer<typeof createOrderSchema>;
export type UpdateOrder = z.infer<typeof updateOrderSchema>;
export type CreateInvoice = z.infer<typeof createInvoiceSchema>;
