import "server-only";
import { MIGRATIONS } from "./migrations";
import { seed } from "./seed";

/**
 * One Postgres interface for the whole app.
 * - Default: a `pg` connection pool to DATABASE_URL, or the Neon database below if it is not set.
 * - USE_PGLITE=1 (local testing): an embedded PGlite database in `.data/pglite`, so test runs never touch Neon.
 */
type Row = Record<string, unknown>;
type Driver = { query<T extends Row>(text: string, params?: unknown[]): Promise<T[]> };

type DbGlobal = { __db?: Promise<Driver> };
const g = globalThis as DbGlobal;

const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_dfhqvrPWx4Z6@ep-square-truth-b5a0ft98-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

async function connect(): Promise<Driver> {
  let driver: Driver;
  if (!process.env.USE_PGLITE) {
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: DATABASE_URL, max: 5 });
    driver = {
      async query<T extends Row>(text: string, params: unknown[] = []) {
        return (await pool.query(text, params)).rows as T[];
      },
    };
  } else {
    // Serverless disks are temporary: an embedded database there would silently lose every event.
    if (process.env.VERCEL) throw new Error("USE_PGLITE is for local testing only; remove it from the Vercel project.");
    const { PGlite } = await import("@electric-sql/pglite");
    const { mkdir } = await import("fs/promises");
    const dir = process.env.PGLITE_DIR ?? ".data/pglite";
    await mkdir(dir, { recursive: true });
    const pg = new PGlite(dir);
    driver = {
      async query<T extends Row>(text: string, params: unknown[] = []) {
        return (await pg.query<T>(text, params)).rows;
      },
    };
  }
  await migrate(driver);
  await seed(driver);
  return driver;
}

async function migrate(db: Driver) {
  await db.query(`CREATE TABLE IF NOT EXISTS schema_migrations (version int PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);
  const done = new Set((await db.query<{ version: number }>(`SELECT version FROM schema_migrations`)).map((r) => r.version));
  for (const m of MIGRATIONS) {
    if (done.has(m.version)) continue;
    for (const stmt of m.sql.split(/;\s*$/m).map((s) => s.trim()).filter(Boolean)) await db.query(stmt);
    await db.query(`INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT DO NOTHING`, [m.version]);
  }
}

function db(): Promise<Driver> {
  // Cached on globalThis so dev hot reloads reuse one connection.
  g.__db ??= connect().catch((err) => {
    g.__db = undefined;
    throw err;
  });
  return g.__db;
}

export async function query<T extends Row = Row>(text: string, params?: unknown[]): Promise<T[]> {
  return (await db()).query<T>(text, params);
}

export async function queryOne<T extends Row = Row>(text: string, params?: unknown[]): Promise<T | null> {
  return (await query<T>(text, params))[0] ?? null;
}
