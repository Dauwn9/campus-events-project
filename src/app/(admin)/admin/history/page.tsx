import { PageHeading } from "@/components/workspace/WorkspaceUI";
import HistoryFilters from "@/components/admin/HistoryFilters";
import { getAdminAuditLog } from "@/lib/services/admin";
import {
  filterAuditEntries,
  getAuditActionLabel,
  getAuditEntityType,
  type AuditHistoryFilters,
} from "@/lib/audit-history";

const fieldLabels: Record<string, string> = {
  title: "Событие → Название",
  description: "Событие → Описание",
  location: "Событие → Место",
  startsAt: "Событие → Дата и время → Начало",
  endsAt: "Событие → Дата и время → Окончание",
  capacity: "Событие → Лимит участников",
  categoryId: "Событие → Категория",
  registrationOpensAt: "Событие → Запись → Дата открытия",
  priorityWindowHours: "Событие → Запись → Приоритетное окно",
  status: "Событие → Статус",
  rejectionReason: "Модерация → Причина отказа",
  deleted: "Событие → Удаление",
  role: "Пользователь → Роль",
  blocked: "Пользователь → Блокировка",
  blockedUntil: "Пользователь → Срок блокировки",
  archivedAt: "Событие → Архив",
  categorySlug: "Категория → URL-имя",
  slug: "Категория → URL-имя",
};

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Almaty",
});

function displayValue(field: string, value: string) {
  if (field === "archivedAt" && value === "—") return "Не в архиве";
  if (["startsAt", "endsAt", "registrationOpensAt", "blockedUntil", "archivedAt"].includes(field)) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return dateFormatter.format(date);
  }
  return value;
}

function entityLabel(type: string) {
  if (type === "EVENT") return "Событие";
  if (type === "CATEGORY") return "Категория";
  return "Пользователь";
}

export default async function AdminHistoryPage({
  searchParams,
}: {
  searchParams: Promise<AuditHistoryFilters>;
}) {
  const [entries, params] = await Promise.all([getAdminAuditLog(), searchParams]);
  const filters: AuditHistoryFilters = {
    q: params.q,
    type: params.type,
    action: params.action,
    actor: params.actor,
    entityId: params.entityId,
    from: params.from,
    to: params.to,
  };
  const filteredEntries = filterAuditEntries(entries, filters);
  const activeEntity =
    filters.entityId && entries.find((entry) => entry.entityId === filters.entityId)
      ? entries.find((entry) => entry.entityId === filters.entityId)
      : null;

  return (
    <>
      <PageHeading
        eyebrow="АДМИН-ПАНЕЛЬ / АУДИТ"
        title="История изменений"
        text="Кто, когда и какое поле события, категории или пользователя изменил. Показаны последние 200 записей."
      />
      <HistoryFilters
        initialFilters={filters}
        totalCount={filteredEntries.length}
        activeEntityLabel={activeEntity ? `${activeEntity.entityLabel}` : null}
      />
      <section className="workspace-panel" aria-label="Записи истории изменений">
        {!filteredEntries.length ? (
          <p className="table-empty">Ничего не найдено.</p>
        ) : (
          <ol className="audit-history-list">
            {filteredEntries.map((entry) => {
              const actorRole = "actorRole" in entry ? entry.actorRole ?? "ADMIN" : "ADMIN";
              return (
                <li className="rounded-control border border-border p-4" key={entry.id}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <strong>{entry.entityLabel}</strong>
                    <time className="text-sm text-muted" dateTime={entry.occurredAt}>
                      {dateFormatter.format(new Date(entry.occurredAt))}
                    </time>
                  </div>
                  <p className="mt-2 text-sm">
                    <span className="font-medium">
                      {fieldLabels[entry.field] ?? `${entityLabel(entry.entityType)} → ${entry.field}`}
                    </span>
                    <span className="text-muted"> · {entry.actorName}</span>
                  </p>
                  <p className="mt-2 text-xs text-muted">
                    {[getAuditActionLabel(entry), getAuditEntityType(entry), actorRole].join(" · ")}
                  </p>
                  <p className="mt-1 break-words text-sm">
                    <span className="text-muted">Было:</span>{" "}
                    {displayValue(entry.field, entry.oldValue)}
                    <span className="px-2 text-muted">→</span>
                    <span className="text-muted">Стало:</span>{" "}
                    {displayValue(entry.field, entry.newValue)}
                  </p>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </>
  );
}
