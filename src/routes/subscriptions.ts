import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { HTTPException } from "hono/http-exception";
import {
  createSubscriptionSchema,
  updateSubscriptionSchema,
  renewSubscriptionSchema,
} from "../schemas/subscription";
import { authMiddleware } from "../middleware/auth";
import { getDb } from "../services/db";

type Env = {
  Bindings: {
    DATABASE_URL: string;
    JWT_SECRET: string;
  };
};

const subscriptions = new Hono<Env>();

// All routes require auth
subscriptions.use("/*", authMiddleware());

// GET /api/subscriptions - List all with search/filter
subscriptions.get("/", async (c) => {
  const sql = getDb(c.env.DATABASE_URL);
  const status = c.req.query("status");
  const search = c.req.query("search");
  const page = parseInt(c.req.query("page") || "1");
  const limit = parseInt(c.req.query("limit") || "50");
  const offset = (page - 1) * limit;

  let rows;
  let countResult;

  if (status && search) {
    const searchPattern = `%${search}%`;
    rows = await sql`
      SELECT *, (expiry_date - CURRENT_DATE) as days_remaining
      FROM subscriptions
      WHERE status = ${status}
        AND (customer_email ILIKE ${searchPattern} OR customer_name ILIKE ${searchPattern})
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    countResult = await sql`
      SELECT COUNT(*) as total FROM subscriptions
      WHERE status = ${status}
        AND (customer_email ILIKE ${searchPattern} OR customer_name ILIKE ${searchPattern})
    `;
  } else if (status) {
    rows = await sql`
      SELECT *, (expiry_date - CURRENT_DATE) as days_remaining
      FROM subscriptions
      WHERE status = ${status}
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    countResult = await sql`
      SELECT COUNT(*) as total FROM subscriptions WHERE status = ${status}
    `;
  } else if (search) {
    const searchPattern = `%${search}%`;
    rows = await sql`
      SELECT *, (expiry_date - CURRENT_DATE) as days_remaining
      FROM subscriptions
      WHERE customer_email ILIKE ${searchPattern} OR customer_name ILIKE ${searchPattern}
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    countResult = await sql`
      SELECT COUNT(*) as total FROM subscriptions
      WHERE customer_email ILIKE ${searchPattern} OR customer_name ILIKE ${searchPattern}
    `;
  } else {
    rows = await sql`
      SELECT *, (expiry_date - CURRENT_DATE) as days_remaining
      FROM subscriptions
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    countResult = await sql`SELECT COUNT(*) as total FROM subscriptions`;
  }

  // Dashboard stats
  const stats = await sql`
    SELECT
      COUNT(*) FILTER (WHERE status = 'active') as active_count,
      COUNT(*) FILTER (WHERE status = 'active' AND expiry_date <= CURRENT_DATE + INTERVAL '3 days' AND expiry_date >= CURRENT_DATE) as expiring_soon,
      COUNT(*) FILTER (WHERE status = 'expired') as expired_count,
      COUNT(*) as total_count
    FROM subscriptions
  `;

  return c.json({
    subscriptions: rows,
    stats: stats[0],
    pagination: {
      page,
      limit,
      total: Number(countResult[0].total),
      totalPages: Math.ceil(Number(countResult[0].total) / limit),
    },
  });
});

// POST /api/subscriptions - Add new subscription
subscriptions.post(
  "/",
  zValidator("json", createSubscriptionSchema),
  async (c) => {
    const data = c.req.valid("json");
    const sql = getDb(c.env.DATABASE_URL);

    const durationDays = data.duration_days || 30;

    const result = await sql`
      INSERT INTO subscriptions (
        customer_email, customer_name, plan_name, amount_paid,
        payment_date, expiry_date, duration_days, notes
      ) VALUES (
        ${data.customer_email},
        ${data.customer_name || null},
        ${data.plan_name || "Monthly"},
        ${data.amount_paid || null},
        ${data.payment_date}::date,
        (${data.payment_date}::date + make_interval(days => ${durationDays})),
        ${durationDays},
        ${data.notes || null}
      )
      RETURNING *
    `;

    return c.json({ subscription: result[0] }, 201);
  }
);

// GET /api/subscriptions/:id - Get single
subscriptions.get("/:id", async (c) => {
  const id = parseInt(c.req.param("id"));
  const sql = getDb(c.env.DATABASE_URL);

  const rows = await sql`
    SELECT *, (expiry_date - CURRENT_DATE) as days_remaining
    FROM subscriptions
    WHERE subscription_id = ${id}
  `;

  if (rows.length === 0) {
    throw new HTTPException(404, { message: "Subscription not found" });
  }

  return c.json({ subscription: rows[0] });
});

// PUT /api/subscriptions/:id - Update
subscriptions.put(
  "/:id",
  zValidator("json", updateSubscriptionSchema),
  async (c) => {
    const id = parseInt(c.req.param("id"));
    const data = c.req.valid("json");
    const sql = getDb(c.env.DATABASE_URL);

    // Build dynamic update
    const existing = await sql`
      SELECT * FROM subscriptions WHERE subscription_id = ${id}
    `;
    if (existing.length === 0) {
      throw new HTTPException(404, { message: "Subscription not found" });
    }

    const current = existing[0];
    const email = data.customer_email ?? current.customer_email;
    const name = data.customer_name ?? current.customer_name;
    const plan = data.plan_name ?? current.plan_name;
    const amount = data.amount_paid ?? current.amount_paid;
    const payDate = data.payment_date ?? current.payment_date;
    const duration = data.duration_days ?? current.duration_days;
    const notes = data.notes ?? current.notes;
    const status = data.status ?? current.status;

    const result = await sql`
      UPDATE subscriptions SET
        customer_email = ${email},
        customer_name = ${name},
        plan_name = ${plan},
        amount_paid = ${amount},
        payment_date = ${payDate}::date,
        expiry_date = (${payDate}::date + make_interval(days => ${duration})),
        duration_days = ${duration},
        notes = ${notes},
        status = ${status},
        updated_at = NOW()
      WHERE subscription_id = ${id}
      RETURNING *
    `;

    return c.json({ subscription: result[0] });
  }
);

// DELETE /api/subscriptions/:id
subscriptions.delete("/:id", async (c) => {
  const id = parseInt(c.req.param("id"));
  const sql = getDb(c.env.DATABASE_URL);

  const result = await sql`
    DELETE FROM subscriptions
    WHERE subscription_id = ${id}
    RETURNING subscription_id
  `;

  if (result.length === 0) {
    throw new HTTPException(404, { message: "Subscription not found" });
  }

  return c.json({ deleted: true, id });
});

// POST /api/subscriptions/:id/renew - Renew subscription
subscriptions.post(
  "/:id/renew",
  zValidator("json", renewSubscriptionSchema),
  async (c) => {
    const id = parseInt(c.req.param("id"));
    const data = c.req.valid("json");
    const sql = getDb(c.env.DATABASE_URL);

    const existing = await sql`
      SELECT * FROM subscriptions WHERE subscription_id = ${id}
    `;
    if (existing.length === 0) {
      throw new HTTPException(404, { message: "Subscription not found" });
    }

    const durationDays = data.duration_days || 30;

    const result = await sql`
      UPDATE subscriptions SET
        payment_date = ${data.payment_date}::date,
        expiry_date = (${data.payment_date}::date + make_interval(days => ${durationDays})),
        duration_days = ${durationDays},
        amount_paid = COALESCE(${data.amount_paid || null}, amount_paid),
        status = 'active',
        reminder_sent = false,
        updated_at = NOW()
      WHERE subscription_id = ${id}
      RETURNING *
    `;

    return c.json({ subscription: result[0], renewed: true });
  }
);

export default subscriptions;
