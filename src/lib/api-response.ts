import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { ServiceError, type ServiceErrorCode } from "@/lib/services/errors";

const STATUS: Record<ServiceErrorCode, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  ALREADY_REGISTERED: 409,
  ALREADY_EXISTS: 409,
  EVENT_FULL: 409,
  CATEGORY_IN_USE: 409,
  EVENT_PAST: 422,
  NOT_OPEN_YET: 422,
  INTERNAL: 500,
};

export function apiError(error: unknown) {
  if (error instanceof z.ZodError)
    return Response.json(
      {
        error: "Неверные данные",
        issues: error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 400 },
    );
  if (error instanceof SyntaxError)
    return Response.json({ error: "Неверный JSON" }, { status: 400 });
  if (error instanceof ServiceError)
    return Response.json(
      { error: error.message, code: error.code },
      { status: STATUS[error.code] },
    );
  console.error(
    "API error",
    error instanceof Error ? error.message : "unknown",
  );
  return Response.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
}

/** Для API: гость получает 401 вместо redirect. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user.id) throw new ServiceError("UNAUTHORIZED", "Войдите в аккаунт.");
  return user;
}