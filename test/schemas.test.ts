import { describe, it, expect } from "vitest";
import { createOrderSchema, updateOrderSchema, createInvoiceSchema } from "../src/schemas/order";

// ─── createOrderSchema ─────────────────────────────────────────────────────────

describe("createOrderSchema", () => {
  const validOrder = {
    customer_email: "user@example.com",
    items: [{ description: "Monthly Plan", qty: 1, unit_price: 25 }],
  };

  it("accepts a minimal valid order", () => {
    const result = createOrderSchema.safeParse(validOrder);
    expect(result.success).toBe(true);
  });

  it("rejects missing customer_email", () => {
    const result = createOrderSchema.safeParse({ items: validOrder.items });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email format", () => {
    const result = createOrderSchema.safeParse({ ...validOrder, customer_email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("rejects empty items array", () => {
    const result = createOrderSchema.safeParse({ ...validOrder, items: [] });
    expect(result.success).toBe(false);
  });

  it("rejects item with negative unit_price", () => {
    const result = createOrderSchema.safeParse({
      ...validOrder,
      items: [{ description: "Plan", qty: 1, unit_price: -5 }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects item with zero qty", () => {
    const result = createOrderSchema.safeParse({
      ...validOrder,
      items: [{ description: "Plan", qty: 0, unit_price: 25 }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects item with empty description", () => {
    const result = createOrderSchema.safeParse({
      ...validOrder,
      items: [{ description: "", qty: 1, unit_price: 25 }],
    });
    expect(result.success).toBe(false);
  });

  it("accepts optional fields", () => {
    const result = createOrderSchema.safeParse({
      ...validOrder,
      customer_name: "John Doe",
      tax_rate: 10,
      discount: 5,
      currency: "USD",
      notes: "Some note",
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid status values", () => {
    // status is not in createOrderSchema but order_date is optional
    const result = createOrderSchema.safeParse({
      ...validOrder,
      order_date: "2025-03-18",
    });
    expect(result.success).toBe(true);
  });

  it("rejects negative tax_rate", () => {
    const result = createOrderSchema.safeParse({ ...validOrder, tax_rate: -5 });
    expect(result.success).toBe(false);
  });

  it("rejects negative discount", () => {
    const result = createOrderSchema.safeParse({ ...validOrder, discount: -10 });
    expect(result.success).toBe(false);
  });
});

// ─── updateOrderSchema ─────────────────────────────────────────────────────────

describe("updateOrderSchema", () => {
  it("accepts empty object (all optional)", () => {
    const result = updateOrderSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts valid status values", () => {
    for (const status of ["pending", "paid", "cancelled", "refunded"]) {
      const result = updateOrderSchema.safeParse({ status });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid status", () => {
    const result = updateOrderSchema.safeParse({ status: "unknown" });
    expect(result.success).toBe(false);
  });

  it("accepts partial update with only notes", () => {
    const result = updateOrderSchema.safeParse({ notes: "Updated note" });
    expect(result.success).toBe(true);
  });
});

// ─── createInvoiceSchema ───────────────────────────────────────────────────────

describe("createInvoiceSchema", () => {
  it("accepts valid order_id", () => {
    const result = createInvoiceSchema.safeParse({ order_id: 1 });
    expect(result.success).toBe(true);
  });

  it("rejects missing order_id", () => {
    const result = createInvoiceSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects non-integer order_id", () => {
    const result = createInvoiceSchema.safeParse({ order_id: 1.5 });
    expect(result.success).toBe(false);
  });

  it("rejects zero order_id", () => {
    const result = createInvoiceSchema.safeParse({ order_id: 0 });
    expect(result.success).toBe(false);
  });

  it("accepts optional due_date and notes", () => {
    const result = createInvoiceSchema.safeParse({
      order_id: 1,
      due_date: "2025-04-18",
      notes: "Due in 30 days",
    });
    expect(result.success).toBe(true);
  });
});
