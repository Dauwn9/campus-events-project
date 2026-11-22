import { apiError, requireApiRole } from "@/lib/api-response";
import {
  createCommentForUser,
  getPublicComments,
} from "@/lib/services/comments";
import { createCommentInputSchema } from "@/lib/validators/comment";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    return Response.json(await getPublicComments(id), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const actor = await requireApiRole("STUDENT");
    const { id } = await params;
    const body = await request.json();
    const input = createCommentInputSchema.parse({
      eventId: id,
      text: body?.text,
    });
    const comment = await createCommentForUser(actor, input);
    return Response.json(comment, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
