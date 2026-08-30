import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";
import { encryptedAccountExtension } from "./extensions/encrypted-account";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
  connectionTimeoutMillis: 5000,
  max: 10,
});

function createPrismaClient() {
  return new PrismaClient({ adapter }).$extends(encryptedAccountExtension);
}

type ExtendedPrismaClient = ReturnType<typeof createPrismaClient>;

const globalForPrisma = globalThis as unknown as {
  prisma: ExtendedPrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}