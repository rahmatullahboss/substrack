import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { HTTPException } from "hono/http-exception";
import {
  createOrderSchema,
  updateOrderSchema,
  payOrderSchema,
} from "../schemas/order";
import { authMiddleware } from "../middleware/auth";
import { getDb } from "../services/db";
import {
  computeOrderTotals,
  generateOrderNumber,
} from "../services/invoice";
import type { OrderItem } from "../schemas/order";

type Env = {
  Bindings: {
    DATABASE_URL: string;
    JWT_SECRET: string;
  };
};

const orders = new Hono<Env>();
orders.use("/*", authMiddleware());

// ─── GET /api/orders ───────────────────────────────────────────────────────────
orders.get("/", async (c) => {
  const sql = getDb(c.env.DATABASE_URL);
  const status = c.req.query("status");
  const search = c.req.query("search");
  const subscriptionId = c.req.query("subscription_id")
    ? parseInt(c.req.query("subscription_id")!)
    : null;
  const page = parseInt(c.req.query("page") || "1");
  const limit = parseInt(c.req.query("limit") || "50");
  const offset = (page - 1) * limit;

  let rows: Record<string, unknown>[];
  let countResult: Record<string, unknown>[];

  const searchPattern = search ? `%${search}%` : null;

  if (subscriptionId) {
    rows = await sql`
      SELECT o.*, i.invoice_id, i.invoice_number, i.status as invoice_status
      FROM orders o LEFT JOIN invoices i ON i.order_id = o.order_id
      WHERE o.subscription_id = ${subscriptionId}
      ORDER BY o.created_at DESC LIMIT ${limit} OFFSET ${offset}
    `;
    countResult = await sql`SELECT COUNT(*) as total FROM orders WHERE subscription_id = ${subscriptionId}`;
  } else if (status && search) {
    rows = await sql`
      SELECT o.*, i.invoice_id, i.invoice_number, i.status as invoice_status
      FROM orders o LEFT JOIN invoices i ON i.order_id = o.order_id
      WHERE o.status = ${status}
        AND (o.customer_email ILIKE ${searchPattern} OR o.customer_name ILIKE ${searchPattern} OR o.order_number ILIKE ${searchPattern})
      ORDER BY o.created_at DESC LIMIT ${limit} OFFSET ${offset}
    `;
    countResult = await sql`
      SELECT COUNT(*) as total FROM orders
      WHERE status = ${status}
        AND (customer_email ILIKE ${searchPattern} OR customer_name ILIKE ${searchPattern} OR order_number ILIKE ${searchPattern})
    `;
  } else if (status) {
    rows = await sql`
      SELECT o.*, i.invoice_id, i.invoice_number, i.status as invoice_status
      FROM orders o LEFT JOIN invoices i ON i.order_id = o.order_id
      WHERE o.status = ${status}
      ORDER BY o.created_at DESC LIMIT ${limit} OFFSET ${offset}
    `;
    countResult = await sql`SELECT COUNT(*) as total FROM orders WHERE status = ${status}`;
  } else if (search) {
    rows = await sql`
      SELECT o.*, i.invoice_id, i.invoice_number, i.status as invoice_status
      FROM orders o LEFT JOIN invoices i ON i.order_id = o.order_id
      WHERE o.customer_email ILIKE ${searchPattern} OR o.customer_name ILIKE ${searchPattern} OR o.order_number ILIKE ${searchPattern}
      ORDER BY o.created_at DESC LIMIT ${limit} OFFSET ${offset}
    `;
    countResult = await sql`
      SELECT COUNT(*) as total FROM orders
      WHERE customer_email ILIKE ${searchPattern} OR customer_name ILIKE ${searchPattern} OR order_number ILIKE ${searchPattern}
    `;
  } else {
    rows = await sql`
      SELECT o.*, i.invoice_id, i.invoice_number, i.status as invoice_status
      FROM orders o LEFT JOIN invoices i ON i.order_id = o.order_id
      ORDER BY o.created_at DESC LIMIT ${limit} OFFSET ${offset}
    `;
    countResult = await sql`SELECT COUNT(*) as total FROM orders`;
  }

  const stats = await sql`
    SELECT
      COUNT(*) as total_orders,
      COUNT(*) FILTER (WHERE status = 'pending') as pending,
      COUNT(*) FILTER (WHERE status = 'paid') as paid,
      COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
      COUNT(*) FILTER (WHERE status = 'refunded') as refunded,
      COALESCE(SUM(total_amount) FILTER (WHERE status = 'paid'), 0) as total_revenue
    FROM orders
  `;

  return c.json({
    orders: rows,
    stats: stats[0],
    pagination: {
      page,
      limit,
      total: Number(countResult[0].total),
      totalPages: Math.ceil(Number(countResult[0].total) / limit),
    },
  });
});

// ─── POST /api/orders ──────────────────────────────────────────────────────────
orders.post("/", zValidator("json", createOrderSchema), async (c) => {
  const data = c.req.valid("json");
  const sql = getDb(c.env.DATABASE_URL);

  const items = data.items as OrderItem[];
  const taxRate = data.tax_rate ?? 0;
  const discount = data.discount ?? 0;
  const { subtotal, tax_amount, total_amount } = computeOrderTotals(items, taxRate, discount);
  const orderNumber = await generateOrderNumber(sql);
  const orderDate = data.order_date ?? new Date().toISOString().slice(0, 10);

  const result = await sql`
    INSERT INTO orders (
      subscription_id, customer_email, customer_name, order_number, order_date,
      items, subtotal, tax_rate, tax_amount, discount, total_amount, currency,
      payment_method, notes
    ) VALUES (
      ${data.subscription_id ?? null},
      ${data.customer_email},
      ${data.customer_name ?? null},
      ${orderNumber},
      ${orderDate}::date,
      ${JSON.stringify(items)},
      ${subtotal},
      ${taxRate},
      ${tax_amount},
      ${discount},
      ${total_amount},
      ${data.currency ?? "USD"},
      ${data.payment_method ?? null},
      ${data.notes ?? null}
    )
    RETURNING *
  `;

  return c.json({ order: result[0] }, 201);
});

// ─── GET /api/orders/:id ───────────────────────────────────────────────────────
orders.get("/:id", async (c) => {
  const id = parseInt(c.req.param("id"));
  if (isNaN(id)) throw new HTTPException(400, { message: "Invalid order ID" });
  const sql = getDb(c.env.DATABASE_URL);

  const rows = await sql`
    SELECT o.*,
      i.invoice_id, i.invoice_number, i.issued_date, i.due_date,
      i.status as invoice_status, i.notes as invoice_notes
    FROM orders o
    LEFT JOIN invoices i ON i.order_id = o.order_id
    WHERE o.order_id = ${id}
  `;

  if (rows.length === 0) throw new HTTPException(404, { message: "Order not found" });

  return c.json({ order: rows[0] });
});

// ─── PUT /api/orders/:id ───────────────────────────────────────────────────────
orders.put("/:id", zValidator("json", updateOrderSchema), async (c) => {
  const id = parseInt(c.req.param("id"));
  if (isNaN(id)) throw new HTTPException(400, { message: "Invalid order ID" });
  const data = c.req.valid("json");
  const sql = getDb(c.env.DATABASE_URL);

  const existing = await sql`SELECT * FROM orders WHERE order_id = ${id}`;
  if (existing.length === 0) throw new HTTPException(404, { message: "Order not found" });

  const cur = existing[0];

  // Recompute totals if items/tax/discount changed
  const items = (data.items ?? cur.items) as OrderItem[];
  const taxRate = data.tax_rate ?? Number(cur.tax_rate);
  const discount = data.discount ?? Number(cur.discount);
  const { subtotal, tax_amount, total_amount } = computeOrderTotals(items, taxRate, discount);

  const result = await sql`
    UPDATE orders SET
      customer_email   = ${data.customer_email ?? cur.customer_email},
      customer_name    = ${data.customer_name ?? cur.customer_name},
      order_date       = ${(data.order_date ?? cur.order_date.toISOString().slice(0,10))}::date,
      items            = ${JSON.stringify(items)},
      subtotal         = ${subtotal},
      tax_rate         = ${taxRate},
      tax_amount       = ${tax_amount},
      discount         = ${discount},
      total_amount     = ${total_amount},
      currency         = ${data.currency ?? cur.currency},
      payment_method   = ${data.payment_method ?? cur.payment_method},
      payment_date     = ${data.payment_date ? sql`${data.payment_date}::date` : cur.payment_date},
      status           = ${data.status ?? cur.status},
      notes            = ${data.notes ?? cur.notes},
      updated_at       = NOW()
    WHERE order_id = ${id}
    RETURNING *
  `;

  return c.json({ order: result[0] });
});

// ─── DELETE /api/orders/:id ────────────────────────────────────────────────────
orders.delete("/:id", async (c) => {
  const id = parseInt(c.req.param("id"));
  if (isNaN(id)) throw new HTTPException(400, { message: "Invalid order ID" });
  const sql = getDb(c.env.DATABASE_URL);

  const existing = await sql`SELECT status FROM orders WHERE order_id = ${id}`;
  if (existing.length === 0) throw new HTTPException(404, { message: "Order not found" });
  if (existing[0].status === "paid") {
    throw new HTTPException(400, { message: "Cannot delete a paid order. Cancel or refund it first." });
  }

  await sql`DELETE FROM orders WHERE order_id = ${id}`;
  return c.json({ deleted: true, id });
});

// ─── POST /api/orders/:id/pay ──────────────────────────────────────────────────
orders.post("/:id/pay", zValidator("json", payOrderSchema), async (c) => {
  const id = parseInt(c.req.param("id"));
  if (isNaN(id)) throw new HTTPException(400, { message: "Invalid order ID" });
  const data = c.req.valid("json");
  const sql = getDb(c.env.DATABASE_URL);

  const existing = await sql`SELECT * FROM orders WHERE order_id = ${id}`;
  if (existing.length === 0) throw new HTTPException(404, { message: "Order not found" });
  if (existing[0].status === "paid") {
    throw new HTTPException(400, { message: "Order is already paid" });
  }

  const payDate = data.payment_date ?? new Date().toISOString().slice(0, 10);

  const result = await sql`
    UPDATE orders SET
      status = 'paid',
      payment_date = ${payDate}::date,
      payment_method = COALESCE(${data.payment_method ?? null}, payment_method),
      updated_at = NOW()
    WHERE order_id = ${id}
    RETURNING *
  `;

  // Also mark the linked invoice as paid (if any)
  await sql`
    UPDATE invoices SET status = 'paid'
    WHERE order_id = ${id} AND status NOT IN ('cancelled')
  `;

  return c.json({ order: result[0], paid: true });
});

// ─── POST /api/orders/:id/cancel ──────────────────────────────────────────────
orders.post("/:id/cancel", async (c) => {
  const id = parseInt(c.req.param("id"));
  if (isNaN(id)) throw new HTTPException(400, { message: "Invalid order ID" });
  const sql = getDb(c.env.DATABASE_URL);

  const existing = await sql`SELECT status FROM orders WHERE order_id = ${id}`;
  if (existing.length === 0) throw new HTTPException(404, { message: "Order not found" });
  if (existing[0].status === "cancelled") {
    throw new HTTPException(400, { message: "Order is already cancelled" });
  }

  const result = await sql`
    UPDATE orders SET status = 'cancelled', updated_at = NOW()
    WHERE order_id = ${id}
    RETURNING *
  `;

  await sql`
    UPDATE invoices SET status = 'cancelled'
    WHERE order_id = ${id} AND status NOT IN ('paid')
  `;

  return c.json({ order: result[0], cancelled: true });
});

export default orders;
