import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { readStore } from "@/lib/services/demo-store";
import { getPrisma } from "@/lib/prisma";
import { USE_MOCKS } from "@/lib/services/errors";
import { eventInclude, toEventDto } from "@/lib/services/event-prisma";
import { datePart } from "@/lib/event-design";
import { eventOperationAction } from "@/app/campus-actions";
import {
  PageHeading,
  Stats,
  Panel,
  Status,
} from "@/components/workspace/WorkspaceUI";
import ParticipantsTable from "@/components/workspace/ParticipantsTable";
import ActionForm from "@/components/workspace/ActionForm";
import Icon from "@/components/ui/Icon";
export default async function OrganizerEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const user = await requireRole("ORGANIZER");
  const { id } = await params;
  const query = await searchParams;
  const store = USE_MOCKS ? readStore() : null;
  const event = USE_MOCKS
    ? store!.events.find((item) => item.id === id && item.organizerId === user.id)
    : await getPrisma().event.findFirst({
        where: { id, organizerId: user.id, archivedAt: null },
        include: eventInclude,
      }).then((record) => record ? toEventDto(record) : undefined);
  if (!event) notFound();
  const registrations = USE_MOCKS
    ? store!.registrations
        .filter((registration) => registration.eventId === id)
        .map((registration) => ({
          ...registration,
          person: store!.users.find((item) => item.id === registration.userId),
        }))
    : await getPrisma().registration.findMany({
        where: { eventId: id },
        include: { user: { select: { name: true, email: true, group: true } } },
        orderBy: { createdAt: "asc" },
      }).then((rows) =>
        rows.map((registration) => ({
          ...registration,
          checkedInAt: registration.checkedInAt?.toISOString() ?? null,
          person: registration.user,
        })),
      );
  const participants = registrations.map((registration) => {
    const person = registration.person;
    return {
      id: registration.id,
      name: person?.name ?? "Участник",
      email: person?.email ?? "",
      group: person?.group ?? "",
      status: registration.status,
      checkedInAt: registration.checkedInAt,
      shortCode: registration.shortCode ?? "",
    };
  });
  return (
    <>
      <Link className="workspace-back" href="/organizer">
        ← Мои события
      </Link>
      <PageHeading
        eyebrow="УПРАВЛЕНИЕ СОБЫТИЕМ"
        title={event.title}
        text={`${datePart(event.startsAt, { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })} · ${event.location}`}
        action={<Status value={event.status} />}
      />
      {query.saved && (
        <p role="status" className="form-success">
          Событие сохранено.{" "}
          {event.status === "DRAFT"
            ? "Черновик виден только вам."
            : "Администратор увидит его в очереди модерации."}
        </p>
      )}
      {event.rejectionReason && (
        <p className="form-error">Причина отказа: {event.rejectionReason}</p>
      )}
      <Stats
        items={[
          {
            label: "Записались",
            value: event.registeredCount,
            note: `из ${event.capacity} мест`,
          },
          {
            label: "Ожидают место",
            value: registrations.filter((r) => r.status === "WAITLIST").length,
          },
          {
            label: "Пришли",
            value: registrations.filter((r) => r.checkedInAt).length,
          },
          {
            label: "Свободно мест",
            value: Math.max(0, event.capacity - event.registeredCount),
          },
        ]}
      />
      <div className="event-management-actions">
        <Link
          className="workspace-button"
          href={`/organizer/scanner?event=${id}`}
        >
          Сканировать билеты <Icon name="arrow" size={16} />
        </Link>
        <Link
          className="workspace-button secondary"
          href={`/organizer/${id}/edit`}
        >
          Редактировать
        </Link>
        {["PUBLISHED", "FINISHED"].includes(event.status) && (
          <Link className="workspace-button secondary" href={`/events/${id}`}>
            Страница события
          </Link>
        )}
        {["DRAFT", "REJECTED"].includes(event.status) && (
          <ActionForm action={eventOperationAction.bind(null, id, "submit")}>
            <button className="workspace-button secondary">
              Отправить на модерацию
            </button>
          </ActionForm>
        )}
      </div>
      <Panel title="Участники и посещаемость">
        <ParticipantsTable participants={participants} eventId={id} />
      </Panel>
      <div className="workspace-panel event-danger-zone">
        <div>
          <h2>Управление публикацией</h2>
          <p>
            Отмена сохраняет историю события и снимает активные записи. Удаление
            доступно, когда действующих участников нет.
          </p>
        </div>
        <ActionForm
          action={eventOperationAction.bind(null, id, "cancel")}
          confirm="Отменить событие и активные записи участников?"
        >
          <button
            className="workspace-button danger"
            disabled={event.status === "CANCELLED"}
          >
            Отменить событие
          </button>
        </ActionForm>
        <ActionForm
          action={eventOperationAction.bind(null, id, "delete")}
          confirm="Удалить событие? Его карточка и связанные записи будут удалены."
        >
          <button className="workspace-button secondary danger">Удалить</button>
        </ActionForm>
      </div>
    </>
  );
}
