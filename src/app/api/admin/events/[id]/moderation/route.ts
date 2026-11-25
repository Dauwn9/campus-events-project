import { z } from "zod";
import { apiError, requireApiRole } from "@/lib/api-response";
import { moderateEvent } from "@/lib/services/admin";

const moderationSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  reason: z.string().max(1000).optional(),
});

/** Одобрить или отклонить (с причиной) событие из очереди модерации. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireApiRole("ADMIN");
    const { id } = await params;
    const { decision, reason } = moderationSchema.parse(await request.json());
    return Response.json(await moderateEvent(actor, id, decision, reason ?? ""));
  } catch (error) {
    return apiError(error);
  }
}
