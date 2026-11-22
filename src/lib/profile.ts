import { APIError } from "better-auth/api";
import { auth } from "@/lib/better-auth";
import { getPrisma } from "@/lib/prisma";
import { ServiceError } from "@/lib/services/errors";

export async function updateProfileName(userId: string, name: string) {
  return getPrisma().user.update({
    where: { id: userId },
    data: { name },
    select: { id: true, name: true },
  });
}

export async function changeProfilePassword(
  headers: Headers,
  currentPassword: string,
  newPassword: string,
) {
  try {
    return await auth.api.changePassword({
      body: {
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      },
      headers,
    });
  } catch (error) {
    if (error instanceof APIError && error.body?.code === "INVALID_PASSWORD") {
      throw new ServiceError("UNAUTHORIZED", "Текущий пароль неверен.");
    }
    throw error;
  }
}
