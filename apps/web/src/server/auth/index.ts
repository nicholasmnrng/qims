import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";

import { db } from "@/server/db";
import {
  schema,
  userRoleValues,
  userStatusValues,
} from "@/server/db/schema";
import { env } from "@/server/env";

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  emailAndPassword: {
    enabled: true,
  },
  user: {
    modelName: "users",
    additionalFields: {
      employeeId: {
        type: "string",
        required: false,
        input: false,
      },
      role: {
        type: [...userRoleValues],
        required: true,
        defaultValue: "inspector",
        input: false,
      },
      status: {
        type: [...userStatusValues],
        required: true,
        defaultValue: "active",
        input: false,
      },
    },
  },
  session: {
    modelName: "sessions",
  },
  account: {
    modelName: "accounts",
  },
  verification: {
    modelName: "verifications",
  },
});
