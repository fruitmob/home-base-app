import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { defineConfig, env } from "prisma/config";

// On platforms like Vercel, env vars come from the platform; .env doesn't exist.
if (existsSync(".env")) {
  loadEnvFile();
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("POSTGRES_URL_NON_POOLING"),
  },
});
