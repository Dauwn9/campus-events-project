import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { readStore } from "@/lib/services/demo-store";
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
  const store = readStore();
  const event = store.events.find(
    (e) => e.id === id && e.organizerId === user.id,
  );
  if (!event) notFound();
  const registrations = store.registrations.filter((r) => r.eventId === id);
  const participants = registrations.map((r) => {
    const person = store.users.find((u) => u.id === r.userId)!;
    return {
      id: r.id,
      name: person.name,
      email: person.email,
      group: person.group,
      status: r.status,
      checkedInAt: r.checkedInAt,
      shortCode: r.shortCode,
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
