import { apiError, requireApiRole } from "@/lib/api-response";
import { getEventParticipants } from "@/lib/services/organizer";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireApiRole("ORGANIZER", "ADMIN");
    const { id } = await params;
    const { participants } = await getEventParticipants(actor, id);

    const cell = (value: string) =>
      `"${(/^[=+@\-\t\r]/.test(value) ? `'${value}` : value).replaceAll('"', '""')}"`;
    const rows = participants.map((participant) =>
      [
        participant.name,
        participant.email,
        participant.group,
        participant.status,
        participant.checkedInAt ?? "",
      ]
        .map(cell)
        .join(";"),
    );

    return new Response(
      `﻿Имя;Email;Группа;Статус;Вход\r\n${rows.join("\r\n")}`,
      {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="participants-${id}.csv"`,
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    return apiError(error);
  }
}
