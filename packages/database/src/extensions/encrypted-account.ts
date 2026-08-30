import { Prisma } from "../generated/prisma/client";
import { encrypt, decrypt } from "../encryption";

// Fields on the Account model that must be encrypted at rest.
const ENCRYPTED_FIELDS = [
  "access_token",
  "refresh_token",
  "id_token",
] as const;

type EncryptedField = (typeof ENCRYPTED_FIELDS)[number];

function encryptFields<T extends Record<string, unknown>>(data: T): T {
  const result = { ...data } as Record<string, unknown>;
  for (const field of ENCRYPTED_FIELDS) {
    const key = field as string;
    const value = result[key];
    if (typeof value === "string") {
      result[key] = encrypt(value);
    }
  }
  return result as T;
}

function decryptFields<T extends Record<string, unknown> | null>(
  record: T
): T {
  if (!record) return record;
  const result = { ...record } as Record<string, unknown>;
  for (const field of ENCRYPTED_FIELDS) {
    const key = field as string;
    const value = result[key];
    if (typeof value === "string") {
      try {
        result[key] = decrypt(value);
      } catch (err) {
        // Data that was never encrypted (e.g. pre-migration rows) or
        // corrupted data will fail here. Fail loudly rather than
        // silently returning ciphertext as if it were a valid token.
        throw new Error(
          `Failed to decrypt Account.${field} (id lookup context lost at this layer): ${
            (err as Error).message
          }`
        );
      }
    }
  }
  return result as T;
}

export const encryptedAccountExtension = Prisma.defineExtension({
  name: "encrypted-account-tokens",
  query: {
    account: {
      async create({ args, query }) {
        args.data = encryptFields(args.data);
        const result = await query(args);
        return decryptFields(result);
      },
      async update({ args, query }) {
        if (args.data) {
          args.data = encryptFields(args.data as Record<string, unknown>);
        }
        const result = await query(args);
        return decryptFields(result);
      },
      async upsert({ args, query }) {
        args.create = encryptFields(args.create);
        if (args.update) {
          args.update = encryptFields(
            args.update as Record<string, unknown>
          );
        }
        const result = await query(args);
        return decryptFields(result);
      },
      async findUnique({ args, query }) {
        const result = await query(args);
        return decryptFields(result);
      },
      async findFirst({ args, query }) {
        const result = await query(args);
        return decryptFields(result);
      },
      async findMany({ args, query }) {
        const results = await query(args);
        return results.map((r) => decryptFields(r));
      },
    },
  },
});