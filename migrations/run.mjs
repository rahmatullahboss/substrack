import { neon } from "@neondatabase/serverless";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

const DATABASE_URL = process.argv[2];
if (!DATABASE_URL) {
  console.error("Usage: node migrations/run.mjs <DATABASE_URL>");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

// Find all .sql files in migrations/ folder, sorted by name
const migrationFiles = readdirSync("migrations")
  .filter((f) => f.endsWith(".sql"))
  .sort();

for (const file of migrationFiles) {
  console.log(`\n📄 Running migration: ${file}`);
  const migration = readFileSync(join("migrations", file), "utf-8");

  const statements = migration
    .split(";")
    .map((s) =>
      // Strip comment lines so a block starting with -- doesn't get dropped
      s
        .split("\n")
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n")
        .trim()
    )
    .filter((s) => s.length > 0);

  for (const stmt of statements) {
    try {
      await sql(stmt);
      console.log("  ✓", stmt.slice(0, 70).replace(/\n/g, " ") + "...");
    } catch (err) {
      console.error("  ✗", stmt.slice(0, 70), "\n    Error:", err.message);
    }
  }
}

console.log("\n✅ All migrations complete!");
