import { apiError, requireApiRole } from "@/lib/api-response";
import { deleteCommentForUser } from "@/lib/services/comments";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireApiRole("STUDENT", "ADMIN");
    const { id } = await params;
    const eventId = await deleteCommentForUser(actor, id);
    return Response.json({ eventId });
  } catch (error) {
    return apiError(error);
  }
}
