import { describe, it, expect } from "vitest";
import {
  computeOrderTotals,
  generateInvoiceHtml,
} from "../src/services/invoice";

// ─── computeOrderTotals ───────────────────────────────────────────────────────

describe("computeOrderTotals", () => {
  it("calculates subtotal from items", () => {
    const items = [
      { description: "Plan", qty: 1, unit_price: 25 },
    ];
    const result = computeOrderTotals(items, 0, 0);
    expect(result.subtotal).toBe(25);
    expect(result.tax_amount).toBe(0);
    expect(result.total_amount).toBe(25);
  });

  it("handles multiple items", () => {
    const items = [
      { description: "Plan A", qty: 2, unit_price: 25 },
      { description: "Setup", qty: 1, unit_price: 10 },
    ];
    const result = computeOrderTotals(items, 0, 0);
    expect(result.subtotal).toBe(60);
    expect(result.total_amount).toBe(60);
  });

  it("applies tax rate correctly", () => {
    const items = [{ description: "Plan", qty: 1, unit_price: 100 }];
    const result = computeOrderTotals(items, 10, 0); // 10% tax
    expect(result.subtotal).toBe(100);
    expect(result.tax_amount).toBe(10);
    expect(result.total_amount).toBe(110);
  });

  it("applies discount correctly", () => {
    const items = [{ description: "Plan", qty: 1, unit_price: 100 }];
    const result = computeOrderTotals(items, 0, 15); // $15 discount
    expect(result.subtotal).toBe(100);
    expect(result.tax_amount).toBe(0);
    expect(result.total_amount).toBe(85);
  });

  it("applies both tax and discount", () => {
    const items = [{ description: "Plan", qty: 2, unit_price: 50 }]; // subtotal 100
    const result = computeOrderTotals(items, 10, 5); // +$10 tax, -$5 discount
    expect(result.subtotal).toBe(100);
    expect(result.tax_amount).toBe(10);
    expect(result.total_amount).toBe(105); // 100 + 10 - 5
  });

  it("handles fractional cents with rounding", () => {
    const items = [{ description: "Item", qty: 3, unit_price: 33.33 }];
    const result = computeOrderTotals(items, 0, 0);
    expect(result.subtotal).toBe(99.99);
    expect(result.total_amount).toBe(99.99);
  });

  it("returns zero for empty items", () => {
    const result = computeOrderTotals([], 10, 5);
    expect(result.subtotal).toBe(0);
    expect(result.tax_amount).toBe(0);
    expect(result.total_amount).toBe(-5); // 0 + 0 - 5 (discount still applied)
  });

  it("handles zero tax rate", () => {
    const items = [{ description: "Plan", qty: 1, unit_price: 25 }];
    const result = computeOrderTotals(items, 0, 0);
    expect(result.tax_amount).toBe(0);
  });
});

// ─── generateInvoiceHtml ──────────────────────────────────────────────────────

describe("generateInvoiceHtml", () => {
  const mockOrder = {
    order_id: 1,
    order_number: "ORD-20250318-001",
    customer_email: "test@example.com",
    customer_name: "John Doe",
    order_date: "2025-03-18",
    items: [
      { description: "Monthly Plan", qty: 1, unit_price: 25 },
    ],
    subtotal: 25,
    tax_rate: 0,
    tax_amount: 0,
    discount: 0,
    total_amount: 25,
    currency: "USD",
    payment_method: "Card",
    notes: null,
  };

  const mockInvoice = {
    invoice_id: 1,
    invoice_number: "INV-20250318-001",
    issued_date: "2025-03-18",
    due_date: null,
    status: "draft" as const,
    notes: null,
  };

  it("returns a non-empty HTML string", () => {
    const html = generateInvoiceHtml(mockOrder, mockInvoice);
    expect(typeof html).toBe("string");
    expect(html.length).toBeGreaterThan(100);
  });

  it("contains the invoice number", () => {
    const html = generateInvoiceHtml(mockOrder, mockInvoice);
    expect(html).toContain("INV-20250318-001");
  });

  it("contains the order number", () => {
    const html = generateInvoiceHtml(mockOrder, mockInvoice);
    expect(html).toContain("ORD-20250318-001");
  });

  it("contains the customer name", () => {
    const html = generateInvoiceHtml(mockOrder, mockInvoice);
    expect(html).toContain("John Doe");
  });

  it("contains the customer email", () => {
    const html = generateInvoiceHtml(mockOrder, mockInvoice);
    expect(html).toContain("test@example.com");
  });

  it("contains the total amount formatted in USD", () => {
    const html = generateInvoiceHtml(mockOrder, mockInvoice);
    expect(html).toContain("25.00");
    expect(html).toContain("$");
  });

  it("contains the item description", () => {
    const html = generateInvoiceHtml(mockOrder, mockInvoice);
    expect(html).toContain("Monthly Plan");
  });

  it("is valid HTML with DOCTYPE", () => {
    const html = generateInvoiceHtml(mockOrder, mockInvoice);
    expect(html).toMatch(/<!DOCTYPE html>/i);
  });

  it("handles null customer name gracefully", () => {
    const orderNoName = { ...mockOrder, customer_name: null };
    const html = generateInvoiceHtml(orderNoName, mockInvoice);
    expect(typeof html).toBe("string");
    expect(html).toContain("test@example.com");
  });

  it("shows tax line when tax_rate > 0", () => {
    const taxedOrder = { ...mockOrder, tax_rate: 10, tax_amount: 2.5, total_amount: 27.5 };
    const html = generateInvoiceHtml(taxedOrder, mockInvoice);
    expect(html).toContain("2.50"); // tax amount
  });

  it("shows discount line when discount > 0", () => {
    const discountedOrder = { ...mockOrder, discount: 5, total_amount: 20 };
    const html = generateInvoiceHtml(discountedOrder, mockInvoice);
    expect(html).toContain("5.00"); // discount amount
  });
});
