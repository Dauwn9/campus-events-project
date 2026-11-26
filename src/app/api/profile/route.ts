import { apiError, requireApiRole } from "@/lib/api-response";
import { updateProfileName } from "@/lib/profile";
import { profileNameInputSchema } from "@/lib/validators/profile";

export async function PATCH(request: Request) {
  try {
    await requireApiRole("STUDENT", "ORGANIZER", "ADMIN");
    const body = await request.json();
    const input = profileNameInputSchema.parse({
      name: body?.name,
    });
    const updated = await updateProfileName(request.headers, input.name);
    return Response.json(updated);
  } catch (error) {
    return apiError(error);
  }
}
