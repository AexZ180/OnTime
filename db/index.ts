import { env } from "cloudflare:workers";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

let _db: ReturnType<typeof drizzle<typeof schema>> | undefined;

export function getDb() {
  if (!_db) {
    if (!env.DATABASE_URL) {
      throw new Error(
        "DATABASE_URL is not configured. Set it in `.dev.vars` for local development or as a secret in production before using the database."
      );
    }

    const client = postgres(env.DATABASE_URL, { prepare: false, max: 1 });
    _db = drizzle(client, { schema });
  }

  return _db;
}
