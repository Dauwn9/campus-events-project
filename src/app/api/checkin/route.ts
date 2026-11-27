// src/app/api/checkin/route.ts
import { z } from "zod";
import { apiError, requireApiRole } from "@/lib/api-response";
import { checkInParticipant } from "@/lib/services/organizer";

const bodySchema = z.object({
  eventId: z.string().trim().min(1).max(128),
  code: z.string().trim().min(4).max(500),
});

export async function POST(request: Request) {
  try {
    const actor = await requireApiRole("ORGANIZER", "ADMIN");
    const { eventId, code } = bodySchema.parse(await request.json());
    const result = await checkInParticipant(actor, eventId, code);

    return Response.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return apiError(error);
  }
}