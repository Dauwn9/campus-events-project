import { APIError, createAuthMiddleware } from "better-auth/api";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { getPrisma } from "@/lib/prisma";

const secret = process.env.BETTER_AUTH_SECRET;
if (!secret) {
  throw new Error("BETTER_AUTH_SECRET не задана");
}

// На preview-деплоях Vercel у каждой сборки свой адрес, поэтому, если
// BETTER_AUTH_URL не задан, берём адрес из системных переменных Vercel.
const vercelOrigins = [
  process.env.VERCEL_BRANCH_URL,
  process.env.VERCEL_URL,
]
  .filter((host): host is string => Boolean(host))
  .map((host) => `https://${host}`);

export const auth = betterAuth({
  appName: "CampusEvents",
  baseURL:
    process.env.BETTER_AUTH_URL ?? vercelOrigins[0] ?? "http://localhost:3000",
  trustedOrigins: vercelOrigins,
  secret,
  database: prismaAdapter(getPrisma(), { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  session: {
    modelName: "Session",
  },
  account: {
    modelName: "Account",
  },
  verification: {
    modelName: "Verification",
  },
  user: {
    modelName: "User",
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "STUDENT",
        input: false,
      },
    },
  },
  hooks: {
    before: createAuthMiddleware(async (context) => {
      if (context.path !== "/sign-in/email") return;
      const email = context.body?.email;
      if (typeof email !== "string") return;

      const user = await getPrisma().user.findUnique({
        where: { email: email.trim().toLowerCase() },
        select: { blocked: true, blockedUntil: true },
      });
      if (
        user?.blocked &&
        (!user.blockedUntil || user.blockedUntil.getTime() > Date.now())
      ) {
        throw APIError.from("UNAUTHORIZED", {
          code: "ACCOUNT_BLOCKED",
          message: "Неверный email или пароль, либо аккаунт заблокирован.",
        });
      }
    }),
  },
  plugins: [nextCookies()],
});
