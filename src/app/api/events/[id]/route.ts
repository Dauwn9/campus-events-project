import { getCurrentUser } from "@/lib/auth";
import { apiError, requireUser } from "@/lib/api-response";
import { changeEventStatus, saveCampusEvent } from "@/lib/services/campus";
import { getEventById } from "@/lib/services/events";
import { ServiceError } from "@/lib/services/errors";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();
    const event = await getEventById(id);
        const isPublic = event && ["PUBLISHED", "FINISHED", "CANCELLED"].includes(event.status);
    const isOwnerOrAdmin =
      event && (user.role === "ADMIN" || event.organizerId === user.id);
    // скрытое событие отдаём как 404, чтобы не выдавать, что оно существует
    if (!event || !(isPublic || isOwnerOrAdmin))
      throw new ServiceError("NOT_FOUND", "Событие не найдено.");
    return Response.json(event);
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const user = await requireUser();
    const body = await request.json();
    const current = await getEventById(id);
    if (!current) throw new ServiceError("NOT_FOUND", "Событие не найдено.");
    // saveCampusEvent требует полный набор полей, поэтому дополняем текущими
    const event = saveCampusEvent(
      user,
      {
        ...current,
        ...body,
        organizerId: user.id,
        status: body?.status === "DRAFT" ? "DRAFT" : "PENDING",
      },
      id,
    );
    return Response.json(event);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const user = await requireUser();
    changeEventStatus(user, id, "delete");
    return new Response(null, { status: 204 });
  } catch (error) {
    return apiError(error);
  }
}