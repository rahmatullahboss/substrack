import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { HTTPException } from "hono/http-exception";
import {
  createInvoiceSchema,
  updateInvoiceStatusSchema,
} from "../schemas/order";
import { authMiddleware } from "../middleware/auth";
import { getDb } from "../services/db";
import {
  generateInvoiceNumber,
  generateInvoiceHtml,
} from "../services/invoice";

type Env = {
  Bindings: {
    DATABASE_URL: string;
    JWT_SECRET: string;
    RESEND_API_KEY: string;
    FROM_EMAIL: string;
    ADMIN_EMAIL: string;
  };
};

const invoices = new Hono<Env>();
invoices.use("/*", authMiddleware());

// ─── POST /api/invoices ────────────────────────────────────────────────────────
invoices.post("/", zValidator("json", createInvoiceSchema), async (c) => {
  const data = c.req.valid("json");
  const sql = getDb(c.env.DATABASE_URL);

  // Validate order exists
  const orderRows = await sql`SELECT * FROM orders WHERE order_id = ${data.order_id}`;
  if (orderRows.length === 0) throw new HTTPException(404, { message: "Order not found" });

  // Prevent duplicate invoices
  const existing = await sql`SELECT invoice_id FROM invoices WHERE order_id = ${data.order_id}`;
  if (existing.length > 0) {
    throw new HTTPException(400, {
      message: `Invoice already exists for this order (${existing[0].invoice_id}). Use GET /api/invoices/${existing[0].invoice_id} to retrieve it.`,
    });
  }

  const invoiceNumber = await generateInvoiceNumber(sql);

  const result = await sql`
    INSERT INTO invoices (order_id, invoice_number, due_date, notes)
    VALUES (
      ${data.order_id},
      ${invoiceNumber},
      ${data.due_date ? sql`${data.due_date}::date` : null},
      ${data.notes ?? null}
    )
    RETURNING *
  `;

  return c.json({ invoice: result[0] }, 201);
});

// ─── GET /api/invoices ───────────────────────────────────────────────────────
invoices.get("/", async (c) => {
  const sql = getDb(c.env.DATABASE_URL);
  const status = c.req.query("status");
  const page = parseInt(c.req.query("page") || "1");
  const limit = parseInt(c.req.query("limit") || "50");
  const offset = (page - 1) * limit;

  const rows = status
    ? await sql`
        SELECT i.*, o.customer_name, o.customer_email, o.order_number, o.total_amount, o.currency
        FROM invoices i
        JOIN orders o ON o.order_id = i.order_id
        WHERE i.status = ${status}
        ORDER BY i.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `
    : await sql`
        SELECT i.*, o.customer_name, o.customer_email, o.order_number, o.total_amount, o.currency
        FROM invoices i
        JOIN orders o ON o.order_id = i.order_id
        ORDER BY i.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;

  const total = status
    ? await sql`SELECT COUNT(*) as cnt FROM invoices WHERE status = ${status}`
    : await sql`SELECT COUNT(*) as cnt FROM invoices`;

  return c.json({
    invoices: rows,
    pagination: {
      page,
      limit,
      total: Number(total[0].cnt),
      totalPages: Math.ceil(Number(total[0].cnt) / limit),
    },
  });
});

// ─── GET /api/invoices/:id ─────────────────────────────────────────────────────
invoices.get("/:id", async (c) => {
  const id = parseInt(c.req.param("id"));
  if (isNaN(id)) throw new HTTPException(400, { message: "Invalid invoice ID" });
  const sql = getDb(c.env.DATABASE_URL);

  const rows = await sql`
    SELECT i.*, o.customer_name, o.customer_email, o.order_number,
      o.order_date, o.items, o.subtotal, o.tax_rate, o.tax_amount,
      o.discount, o.total_amount, o.currency, o.payment_method, o.notes as order_notes
    FROM invoices i
    JOIN orders o ON o.order_id = i.order_id
    WHERE i.invoice_id = ${id}
  `;

  if (rows.length === 0) throw new HTTPException(404, { message: "Invoice not found" });

  return c.json({ invoice: rows[0] });
});

// ─── GET /api/invoices/:id/html ────────────────────────────────────────────────
invoices.get("/:id/html", async (c) => {
  const id = parseInt(c.req.param("id"));
  if (isNaN(id)) throw new HTTPException(400, { message: "Invalid invoice ID" });
  const sql = getDb(c.env.DATABASE_URL);

  const rows = await sql`
    SELECT i.*, o.customer_name, o.customer_email, o.order_number,
      o.order_date, o.items, o.subtotal, o.tax_rate, o.tax_amount,
      o.discount, o.total_amount, o.currency, o.payment_method, o.notes as order_notes
    FROM invoices i
    JOIN orders o ON o.order_id = i.order_id
    WHERE i.invoice_id = ${id}
  `;

  if (rows.length === 0) throw new HTTPException(404, { message: "Invoice not found" });

  const row = rows[0];
  const order = {
    order_id: row.order_id,
    order_number: row.order_number,
    customer_email: row.customer_email,
    customer_name: row.customer_name,
    order_date: typeof row.order_date === "string" ? row.order_date : row.order_date.toISOString().slice(0, 10),
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
    issued_date: typeof row.issued_date === "string" ? row.issued_date : row.issued_date.toISOString().slice(0, 10),
    due_date: row.due_date
      ? typeof row.due_date === "string" ? row.due_date : row.due_date.toISOString().slice(0, 10)
      : null,
    status: row.status,
    notes: row.notes,
  };

  const html = generateInvoiceHtml(order, invoice);
  return c.html(html);
});

// ─── POST /api/invoices/:id/send ───────────────────────────────────────────────
invoices.post("/:id/send", async (c) => {
  const id = parseInt(c.req.param("id"));
  if (isNaN(id)) throw new HTTPException(400, { message: "Invalid invoice ID" });
  const sql = getDb(c.env.DATABASE_URL);

  if (!c.env.RESEND_API_KEY) {
    throw new HTTPException(500, { message: "Email service not configured" });
  }

  const rows = await sql`
    SELECT i.*, o.customer_name, o.customer_email, o.order_number,
      o.order_date, o.items, o.subtotal, o.tax_rate, o.tax_amount,
      o.discount, o.total_amount, o.currency, o.payment_method, o.notes as order_notes
    FROM invoices i
    JOIN orders o ON o.order_id = i.order_id
    WHERE i.invoice_id = ${id}
  `;

  if (rows.length === 0) throw new HTTPException(404, { message: "Invoice not found" });

  const row = rows[0];
  const order = {
    order_id: row.order_id,
    order_number: row.order_number,
    customer_email: row.customer_email,
    customer_name: row.customer_name,
    order_date: typeof row.order_date === "string" ? row.order_date : row.order_date.toISOString().slice(0, 10),
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
    issued_date: typeof row.issued_date === "string" ? row.issued_date : row.issued_date.toISOString().slice(0, 10),
    due_date: row.due_date
      ? typeof row.due_date === "string" ? row.due_date : row.due_date.toISOString().slice(0, 10)
      : null,
    status: row.status,
    notes: row.notes,
  };

  const html = generateInvoiceHtml(order, invoice);
  const fromEmail = c.env.FROM_EMAIL || "Substrack <noreply@substrack.dev>";

  const emailResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${c.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [row.customer_email],
      subject: `Invoice ${row.invoice_number} from Substrack`,
      html,
      text: `Invoice ${row.invoice_number}\n\nOrder: ${row.order_number}\nTotal: ${row.currency} ${Number(row.total_amount).toFixed(2)}\n\nPlease view the HTML version of this email to see the full invoice.`,
    }),
  });

  if (!emailResponse.ok) {
    const err = await emailResponse.text();
    console.error(`[INVOICE EMAIL] Failed: ${err}`);
    throw new HTTPException(500, { message: "Failed to send invoice email" });
  }

  // Mark invoice as sent
  await sql`
    UPDATE invoices SET status = 'sent' WHERE invoice_id = ${id} AND status = 'draft'
  `;

  return c.json({ sent: true, to: row.customer_email, invoice_number: row.invoice_number });
});

// ─── PUT /api/invoices/:id/status ──────────────────────────────────────────────
invoices.put(
  "/:id/status",
  zValidator("json", updateInvoiceStatusSchema),
  async (c) => {
    const id = parseInt(c.req.param("id"));
    if (isNaN(id)) throw new HTTPException(400, { message: "Invalid invoice ID" });
    const { status } = c.req.valid("json");
    const sql = getDb(c.env.DATABASE_URL);

    const result = await sql`
      UPDATE invoices SET status = ${status}
      WHERE invoice_id = ${id}
      RETURNING *
    `;

    if (result.length === 0) throw new HTTPException(404, { message: "Invoice not found" });

    return c.json({ invoice: result[0] });
  }
);

export default invoices;
