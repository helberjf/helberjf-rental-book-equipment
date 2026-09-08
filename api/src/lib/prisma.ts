import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var rentalPrisma: PrismaClient | undefined;
}

export const prisma = globalThis.rentalPrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.rentalPrisma = prisma;
}
