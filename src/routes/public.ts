import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { emailQuerySchema } from "../schemas/subscription";
import { getDb } from "../services/db";
import {
  computeOrderTotals,
  generateOrderNumber,
  generateInvoiceNumber,
  generateInvoiceHtml,
} from "../services/invoice";
import type { OrderItem } from "../schemas/order";

type Env = {
  Bindings: {
    DATABASE_URL: string;
  };
};

const publicRoutes = new Hono<Env>();

// ─── Public Order Schema ───────────────────────────────────────────────────────
const publicOrderSchema = z.object({
  customer_email: z.string().email(),
  customer_name: z.string().min(1).max(200).optional(),
  items: z
    .array(
      z.object({
        description: z.string().min(1).max(500),
        qty: z.number().positive(),
        unit_price: z.number().min(0),
      })
    )
    .min(1)
    .max(10),
  notes: z.string().max(1000).optional(),
});

// ─── GET /api/public/status?email=xxx ─────────────────────────────────────────
publicRoutes.get("/status", zValidator("query", emailQuerySchema), async (c) => {
  const { email } = c.req.valid("query");
  const sql = getDb(c.env.DATABASE_URL);

  const rows = await sql`
    SELECT
      customer_name,
      customer_email,
      plan_name,
      payment_date::text as payment_date,
      expiry_date::text as expiry_date,
      duration_days,
      status,
      (expiry_date - CURRENT_DATE) as days_remaining,
      CASE
        WHEN expiry_date < CURRENT_DATE THEN 'expired'
        WHEN expiry_date <= CURRENT_DATE + 3 THEN 'expiring_soon'
        ELSE 'active'
      END as computed_status
    FROM subscriptions
    WHERE LOWER(customer_email) = LOWER(${email})
    ORDER BY payment_date DESC
    LIMIT 10
  `;

  if (rows.length === 0) {
    return c.json({
      found: false,
      message: "No subscription found for this email",
    });
  }

  return c.json({
    found: true,
    subscriptions: rows,
    latest: rows[0],
  });
});

// ─── GET /api/public/stats ────────────────────────────────────────────────────
publicRoutes.get("/stats", async (c) => {
  const sql = getDb(c.env.DATABASE_URL);

  const result = await sql`
    SELECT
      COUNT(*) FILTER (WHERE status = 'active') as active_count,
      COUNT(*) as total_count
    FROM subscriptions
  `;

  return c.json({
    active_count: Number(result[0].active_count),
    total_count: Number(result[0].total_count),
  });
});

// ─── POST /api/public/orders ──────────────────────────────────────────────────
// Customer places an order — auto-generates invoice, returns both
publicRoutes.post(
  "/orders",
  zValidator("json", publicOrderSchema),
  async (c) => {
    const data = c.req.valid("json");
    const sql = getDb(c.env.DATABASE_URL);

    const items = data.items as OrderItem[];
    const { subtotal, tax_amount, total_amount } = computeOrderTotals(items, 0, 0);
    const orderNumber = await generateOrderNumber(sql);
    const invoiceNumber = await generateInvoiceNumber(sql);
    const today = new Date().toISOString().slice(0, 10);

    // Create order
    const orderRows = await sql`
      INSERT INTO orders (
        customer_email, customer_name, order_number, order_date,
        items, subtotal, tax_rate, tax_amount, discount, total_amount,
        currency, notes
      ) VALUES (
        ${data.customer_email},
        ${data.customer_name ?? null},
        ${orderNumber},
        ${today}::date,
        ${JSON.stringify(items)},
        ${subtotal}, 0, ${tax_amount}, 0, ${total_amount},
        'USD',
        ${data.notes ?? null}
      )
      RETURNING *
    `;

    const order = orderRows[0];

    // Auto-generate invoice
    const invoiceRows = await sql`
      INSERT INTO invoices (order_id, invoice_number)
      VALUES (${order.order_id}, ${invoiceNumber})
      RETURNING *
    `;

    const invoice = invoiceRows[0];

    return c.json(
      {
        order,
        invoice,
        invoice_number: invoiceNumber,
        order_number: orderNumber,
      },
      201
    );
  }
);

// ─── GET /api/public/invoices/:invoiceNumber ──────────────────────────────────
// Return rendered HTML invoice by invoice number (no auth — number acts as token)
publicRoutes.get("/invoices/:invoiceNumber", async (c) => {
  const invoiceNumber = c.req.param("invoiceNumber");
  const sql = getDb(c.env.DATABASE_URL);

  const rows = await sql`
    SELECT i.*, o.customer_name, o.customer_email, o.order_number,
      o.order_date, o.items, o.subtotal, o.tax_rate, o.tax_amount,
      o.discount, o.total_amount, o.currency, o.payment_method,
      o.notes as order_notes
    FROM invoices i
    JOIN orders o ON o.order_id = i.order_id
    WHERE i.invoice_number = ${invoiceNumber}
  `;

  if (rows.length === 0) {
    return c.json({ error: "Invoice not found" }, 404);
  }

  const row = rows[0];

  const order = {
    order_id: row.order_id,
    order_number: row.order_number,
    customer_email: row.customer_email,
    customer_name: row.customer_name,
    order_date:
      typeof row.order_date === "string"
        ? row.order_date
        : row.order_date.toISOString().slice(0, 10),
    items: typeof row.items === "string" ? JSON.parse(row.items) : row.items,
    subtotal: Number(row.subtotal),
    tax_rate: Number(row.tax_rate),
    tax_amount: Number(row.tax_amount),
    discount: Number(row.discount),
    total_amount: Number(row.total_amount),
    currency: row.currency,
    payment_method: row.payment_method,
    notes: row.order_notes,
  };

  const invoice = {
    invoice_id: row.invoice_id,
    invoice_number: row.invoice_number,
    issued_date:
      typeof row.issued_date === "string"
        ? row.issued_date
        : row.issued_date.toISOString().slice(0, 10),
    due_date: row.due_date
      ? typeof row.due_date === "string"
        ? row.due_date
        : row.due_date.toISOString().slice(0, 10)
      : null,
    status: row.status,
    notes: row.notes,
  };

  // Return format: ?format=html for raw HTML, default JSON
  const format = c.req.query("format");
  if (format === "html") {
    return c.html(generateInvoiceHtml(order, invoice));
  }

  return c.json({ order, invoice });
});

export default publicRoutes;
