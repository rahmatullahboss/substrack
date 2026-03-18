import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { cors } from "hono/cors";
import authRoutes from "./routes/auth";
import subscriptionRoutes from "./routes/subscriptions";
import publicRoutes from "./routes/public";
import orderRoutes from "./routes/orders";
import invoiceRoutes from "./routes/invoices";
import { getDb } from "./services/db";
import {
  sendExpiryReminder,
  getExpiringSubscriptions,
  markReminderSent,
  markExpiredSubscriptions,
} from "./services/email";

type Env = {
  Bindings: {
    DATABASE_URL: string;
    JWT_SECRET: string;
    RESEND_API_KEY: string;
    ADMIN_EMAIL: string;
    FROM_EMAIL: string;
    ASSETS: Fetcher;
  };
};

const app = new Hono<Env>();

// CORS — allow all for dev, restrict in production
app.use("/api/*", cors());

// Global error handler
app.onError(async (err, c) => {
  console.error(`[ERROR] ${err.message}`);
  if (err instanceof HTTPException) {
    return c.json({ error: err.message }, err.status);
  }
  return c.json({ error: "Internal Server Error" }, 500);
});

// API routes
app.route("/api/auth", authRoutes);
app.route("/api/subscriptions", subscriptionRoutes);
app.route("/api/public", publicRoutes);
app.route("/api/orders", orderRoutes);
app.route("/api/invoices", invoiceRoutes);

// Health check
app.get("/api/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Catch-all: serve React SPA via Static Assets binding
app.all("*", async (c) => {
  return c.env.ASSETS.fetch(c.req.raw);
});

// Scheduled handler — daily cron for subscription expiry check
const scheduled: ExportedHandlerScheduledHandler<Env["Bindings"]> = async (
  event,
  env,
  ctx
) => {
  console.log(`[CRON] Running subscription check at ${new Date().toISOString()}`);

  const sql = getDb(env.DATABASE_URL);

  try {
    // 1. Auto-mark expired subscriptions
    const expiredCount = await markExpiredSubscriptions(sql);
    console.log(`[CRON] Marked ${expiredCount} subscriptions as expired`);

    // 2. Find subscriptions expiring in next 3 days
    const expiring = await getExpiringSubscriptions(sql, 3);
    console.log(`[CRON] Found ${expiring.length} subscriptions expiring soon`);

    // 3. Send reminder email if any expiring
    if (expiring.length > 0 && env.RESEND_API_KEY) {
      await sendExpiryReminder(
        env.RESEND_API_KEY,
        env.ADMIN_EMAIL,
        env.FROM_EMAIL || "Substrack <noreply@substrack.dev>",
        expiring
      );

      // 4. Mark reminders as sent
      const ids = expiring.map((s) => s.subscription_id);
      await markReminderSent(sql, ids);
      console.log(`[CRON] Marked ${ids.length} reminders as sent`);
    }
  } catch (err) {
    console.error(`[CRON] Error:`, err);
  }
};

export default {
  fetch: app.fetch,
  scheduled,
} satisfies ExportedHandler<Env["Bindings"]>;
