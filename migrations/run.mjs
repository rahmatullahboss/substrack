import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";

const DATABASE_URL = process.argv[2];
if (!DATABASE_URL) {
  console.error("Usage: node migrations/run.mjs <DATABASE_URL>");
  process.exit(1);
}

const sql = neon(DATABASE_URL);
const migration = readFileSync("migrations/0001_init.sql", "utf-8");

// Split by semicolons and run each statement
const statements = migration
  .split(";")
  .map((s) => s.trim())
  .filter((s) => s.length > 0 && !s.startsWith("--"));

console.log(`Running ${statements.length} statements...`);

for (const stmt of statements) {
  try {
    await sql(stmt);
    console.log("✓", stmt.slice(0, 60).replace(/\n/g, " ") + "...");
  } catch (err) {
    console.error("✗", stmt.slice(0, 60), "\n  Error:", err.message);
  }
}

console.log("\n✅ Migration complete!");
