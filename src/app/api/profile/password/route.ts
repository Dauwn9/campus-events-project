import { APIError } from "better-auth/api";
import { apiError, requireApiRole } from "@/lib/api-response";
import { changeProfilePassword } from "@/lib/profile";
import { ServiceError } from "@/lib/services/errors";
import { passwordChangeInputSchema } from "@/lib/validators/profile";

export async function POST(request: Request) {
  try {
    await requireApiRole("STUDENT", "ORGANIZER", "ADMIN");
    const body = await request.json();
    const input = passwordChangeInputSchema.parse({
      currentPassword: body?.currentPassword,
      password: body?.password,
      passwordConfirmation: body?.passwordConfirmation,
    });
    await changeProfilePassword(
      request.headers,
      input.currentPassword,
      input.password,
    );
    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof ServiceError && error.code === "UNAUTHORIZED") {
      return Response.json(
        {
          error: error.message,
          fieldErrors: { currentPassword: error.message },
        },
        { status: 401 },
      );
    }
    if (error instanceof APIError && error.body?.code === "INVALID_PASSWORD") {
      const message = "Текущий пароль неверен.";
      return Response.json(
        { error: message, fieldErrors: { currentPassword: message } },
        { status: 400 },
      );
    }
    return apiError(error);
  }
}
