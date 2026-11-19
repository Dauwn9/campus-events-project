import { apiError, requireApiRole } from "@/lib/api-response";
import { updateProfileName } from "@/lib/profile";
import { profileInputSchema } from "@/lib/validators/profile";

export async function PATCH(request: Request) {
  try {
    const user = await requireApiRole("STUDENT", "ORGANIZER", "ADMIN");
    const body = await request.json();
    const input = profileInputSchema.parse({
      name: body?.name,
      currentPassword: "",
      password: "",
      passwordConfirmation: "",
    });
    const updated = await updateProfileName(user.id, input.name);
    return Response.json(updated);
  } catch (error) {
    return apiError(error);
  }
}
