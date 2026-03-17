import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { emailQuerySchema } from "../schemas/subscription";
import { getDb } from "../services/db";

type Env = {
  Bindings: {
    DATABASE_URL: string;
  };
};

const publicRoutes = new Hono<Env>();

// GET /api/public/status?email=xxx - Public subscription status check
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

// GET /api/public/stats - Public stats (active subscriber count)
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

export default publicRoutes;

