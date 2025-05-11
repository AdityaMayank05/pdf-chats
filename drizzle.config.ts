import type { Config } from "drizzle-kit";
import { parse } from 'pg-connection-string';
import * as dotenv from "dotenv";
dotenv.config();

const connection = parse(process.env.DATABASE_URL || "");

export default {
  schema: "./src/lib/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    host: connection.host || "",
    port: Number(connection.port) || 5432,
    user: connection.user || "",
    password: connection.password || "",
    database: connection.database || "",
    ssl: true,
  },
} satisfies Config;

// npx drizzle-kit push:pg
