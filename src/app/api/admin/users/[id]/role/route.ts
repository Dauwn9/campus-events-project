import { apiError, requireApiRole } from "@/lib/api-response";
import { updateAdminUser } from "@/lib/services/admin";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireApiRole("ADMIN");
    const { id } = await params;
    const updated = await updateAdminUser(actor, id, await request.json());
    return Response.json(updated);
  } catch (error) {
    return apiError(error);
  }
}
