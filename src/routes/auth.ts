import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { loginSchema, setupSchema } from "../schemas/subscription";
import { createJwt } from "../middleware/auth";
import { getDb } from "../services/db";

type Env = {
  Bindings: {
    DATABASE_URL: string;
    JWT_SECRET: string;
    ADMIN_PASSWORD_HASH: string;
  };
};

const auth = new Hono<Env>();

// POST /api/auth/login - Login with password
auth.post("/login", zValidator("json", loginSchema), async (c) => {
  const { password } = c.req.valid("json");
  const sql = getDb(c.env.DATABASE_URL);

  // Simple password comparison using SHA-256 (Workers-compatible)
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(password)
  );
  const hashHex = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Get admin from DB
  const admins = await sql`SELECT * FROM admin_users LIMIT 1`;

  if (admins.length === 0) {
    // No admin exists yet — first-time setup mode
    return c.json({ error: "No admin account. Use POST /api/auth/setup first." }, 400);
  }

  const admin = admins[0];
  if (admin.password_hash !== hashHex) {
    return c.json({ error: "Invalid password" }, 401);
  }

  const token = await createJwt(
    { email: admin.email, role: "admin" },
    c.env.JWT_SECRET
  );

  return c.json({ token, email: admin.email });
});

// POST /api/auth/setup - First-time admin setup
auth.post("/setup", zValidator("json", setupSchema), async (c) => {
  const { email, password } = c.req.valid("json");
  const sql = getDb(c.env.DATABASE_URL);

  // Check if admin already exists
  const existing = await sql`SELECT admin_id FROM admin_users LIMIT 1`;
  if (existing.length > 0) {
    return c.json({ error: "Admin already exists. Use login instead." }, 400);
  }

  // Hash password with SHA-256
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(password)
  );
  const hashHex = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  await sql`
    INSERT INTO admin_users (email, password_hash)
    VALUES (${email}, ${hashHex})
  `;

  const token = await createJwt(
    { email, role: "admin" },
    c.env.JWT_SECRET
  );

  return c.json({ token, email, message: "Admin account created" });
});

// GET /api/auth/me - Get current admin info
auth.get("/me", async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ authenticated: false });
  }

  try {
    const { verifyJwt } = await import("../middleware/auth");
    const payload = await verifyJwt(authHeader.slice(7), c.env.JWT_SECRET);
    return c.json({ authenticated: true, ...payload });
  } catch {
    return c.json({ authenticated: false });
  }
});

export default auth;
