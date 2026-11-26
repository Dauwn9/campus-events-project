import { apiError, requireApiRole } from "@/lib/api-response";
import { readStore } from "@/lib/services/demo-store";
import { ServiceError, USE_MOCKS } from "@/lib/services/errors";
import { getPrisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireApiRole("ORGANIZER", "ADMIN");
    const { id } = await params;
    const event = USE_MOCKS
      ? readStore().events.find((item) => item.id === id)
      : await getPrisma().event.findUnique({
          where: { id },
          select: { id: true, organizerId: true },
        });
    if (!event) throw new ServiceError("NOT_FOUND", "Событие не найдено.");
    if (actor.role !== "ADMIN" && event.organizerId !== actor.id) {
      throw new ServiceError(
        "FORBIDDEN",
        "Это событие принадлежит другому организатору.",
      );
    }

    const cell = (value: string) =>
      `"${(/^[=+@\-\t\r]/.test(value) ? `'${value}` : value).replaceAll('"', '""')}"`;
    const rows = USE_MOCKS
      ? (() => {
          const store = readStore();
          return store.registrations
            .filter((registration) => registration.eventId === id)
            .map((registration) => {
              const person = store.users.find((item) => item.id === registration.userId);
              return [
                person?.name ?? "Участник",
                person?.email ?? "",
                person?.group ?? "",
                registration.status,
                registration.checkedInAt ?? "",
              ].map(cell).join(";");
            });
        })()
      : await getPrisma().registration.findMany({
          where: { eventId: id },
          include: { user: { select: { name: true, email: true, group: true } } },
          orderBy: { createdAt: "asc" },
        }).then((registrations) =>
          registrations.map((registration) =>
            [
              registration.user.name,
              registration.user.email,
              registration.user.group ?? "",
              registration.status,
              registration.checkedInAt?.toISOString() ?? "",
            ].map(cell).join(";"),
          ),
        );

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
