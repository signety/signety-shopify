/**
 * Prisma client singleton for the Shopify app.
 * Uses SQLite (separate from main Signety PostgreSQL, per MED-10 fix).
 */
import { PrismaClient } from "@prisma/client";

let prisma;

if (process.env.NODE_ENV === "production") {
  prisma = new PrismaClient();
} else {
  // In development, reuse client across hot reloads
  if (!global.__prisma) {
    global.__prisma = new PrismaClient();
  }
  prisma = global.__prisma;
}

export default prisma;
