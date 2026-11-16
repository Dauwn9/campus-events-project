import { apiError, requireUser } from "@/lib/api-response";
import { saveCampusEvent } from "@/lib/services/campus";
import { listEvents } from "@/lib/services/events";
import { eventQuerySchema } from "@/lib/validators/event-query";

export async function GET(request: Request) {
  try {
    const params = Object.fromEntries(new URL(request.url).searchParams);
    return Response.json(await listEvents(eventQuerySchema.parse(params)));
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();
    // organizerId и статус клиенту не доверяем: ставим сами
    const event = saveCampusEvent(user, {
      ...body,
      organizerId: user.id,
      status: body?.status === "DRAFT" ? "DRAFT" : "PENDING",
    });
    return Response.json(event, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}