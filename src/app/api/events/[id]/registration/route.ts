import { apiError, requireApiRole } from "@/lib/api-response";
import { registerForEvent } from "@/lib/services/registrations";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Ctx) {
  try {
    await requireApiRole("STUDENT");
    const { id } = await params;
    const registration = await registerForEvent(id);
    return Response.json(registration, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
