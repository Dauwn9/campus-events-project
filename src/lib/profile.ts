import { APIError } from "better-auth/api";
import { auth } from "@/lib/better-auth";
import { ServiceError } from "@/lib/services/errors";

export async function updateProfileName(headers: Headers, name: string) {
  const session = await auth.api.getSession({ headers });
  if (!session) {
    throw new ServiceError("UNAUTHORIZED", "Войдите в аккаунт.");
  }
  await auth.api.updateUser({
    body: { name },
    headers,
  });
  return { id: session.user.id, name };
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
