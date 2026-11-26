import { apiError, requireApiRole } from "@/lib/api-response";
import { cancelRegistration } from "@/lib/services/registrations";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: Ctx) {
  try {
    await requireApiRole("STUDENT");
    const { id } = await params;
    return Response.json(await cancelRegistration(id));
  } catch (error) {
    return apiError(error);
  }
}
