import { PrismaPg } from "@prisma/adapter-pg";
import { loadEnvFile } from "node:process";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  db?: PrismaClient;
};

function getDatabaseUrl() {
  if (!process.env.POSTGRES_PRISMA_URL && !process.env.DATABASE_URL) {
    loadLocalEnvFile();
  }

  const databaseUrl = process.env.POSTGRES_PRISMA_URL ?? process.env.DATABASE_URL;

  if (!databaseUrl || databaseUrl.includes("${")) {
    throw new Error("POSTGRES_PRISMA_URL or DATABASE_URL must be set before using the database.");
  }

  return databaseUrl;
}

function loadLocalEnvFile() {
  try {
    loadEnvFile();
  } catch {
    // Next.js loads env files for app/runtime code; this is only needed for CLI scripts.
  }
}

function createClient() {
  const adapter = new PrismaPg({
    connectionString: getDatabaseUrl(),
  });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const db = globalForPrisma.db ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.db = db;
}
