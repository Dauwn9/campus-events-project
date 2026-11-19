import { apiError, requireApiRole } from "@/lib/api-response";
import { readStore } from "@/lib/services/demo-store";
import { ServiceError } from "@/lib/services/errors";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireApiRole("ORGANIZER", "ADMIN");
    const { id } = await params;
    const store = readStore();
    const event = store.events.find((item) => item.id === id);
    if (!event) throw new ServiceError("NOT_FOUND", "Событие не найдено.");
    if (actor.role !== "ADMIN" && event.organizerId !== actor.id) {
      throw new ServiceError(
        "FORBIDDEN",
        "Это событие принадлежит другому организатору.",
      );
    }

    const cell = (value: string) =>
      `"${(/^[=+@\-\t\r]/.test(value) ? `'${value}` : value).replaceAll('"', '""')}"`;
    const rows = store.registrations
      .filter((registration) => registration.eventId === id)
      .map((registration) => {
        const user = store.users.find(
          (item) => item.id === registration.userId,
        );
        if (!user) {
          throw new ServiceError(
            "INTERNAL",
            "Не удалось загрузить участника события.",
          );
        }
        return [
          user.name,
          user.email,
          user.group,
          registration.status,
          registration.checkedInAt ?? "",
        ]
          .map(cell)
          .join(";");
      });

    return new Response(
      `\uFEFFИмя;Email;Группа;Статус;Вход\r\n${rows.join("\r\n")}`,
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
