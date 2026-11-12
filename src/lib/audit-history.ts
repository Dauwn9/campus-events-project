import type { CampusAuditEntry } from "@/lib/services/demo-store";

export type AuditHistoryFilters = {
  q?: string;
  type?: "event" | "category" | "user";
  action?: string;
  actor?: "ADMIN" | "ORGANIZER" | "STUDENT" | "all";
  entityId?: string;
  from?: string;
  to?: string;
};

export const AUDIT_ENTITY_OPTIONS = [
  { value: "event", label: "События" },
  { value: "category", label: "Категории" },
  { value: "user", label: "Пользователи" },
] as const;

export const AUDIT_ACTION_OPTIONS = [
  { value: "all", label: "Все действия" },
  { value: "create", label: "Создание" },
  { value: "update", label: "Изменение" },
  { value: "archive", label: "Архивация" },
  { value: "restore", label: "Восстановление" },
  { value: "block", label: "Блокировка" },
  { value: "unblock", label: "Разблокировка" },
  { value: "role", label: "Смена роли" },
  { value: "publish", label: "Публикация" },
  { value: "reject", label: "Отклонение" },
  { value: "submit", label: "Отправка на модерацию" },
  { value: "cancel", label: "Отмена / закрытие" },
  { value: "delete", label: "Удаление" },
] as const;

export const AUDIT_ACTOR_OPTIONS = [
  { value: "all", label: "Все участники" },
  { value: "ADMIN", label: "Администратор" },
  { value: "ORGANIZER", label: "Организатор" },
  { value: "STUDENT", label: "Студент" },
] as const;

export function getAuditEntityType(entry: Pick<CampusAuditEntry, "entityType">) {
  const value = entry.entityType.toLowerCase();
  if (value === "event") return "event";
  if (value === "category") return "category";
  return "user";
}

export function getAuditActionKey(entry: Pick<CampusAuditEntry, "field" | "entityType" | "newValue" | "oldValue">) {
  if (entry.field === "role") return "role";
  if (entry.field === "blocked") return entry.newValue === "Активен" || entry.newValue === "—" ? "unblock" : "block";
  if (entry.field === "blockedUntil") {
    const isUnblock = entry.newValue === "—" || entry.newValue === "null";
    return isUnblock ? "unblock" : "block";
  }
  if (entry.field === "archivedAt") return entry.newValue === "—" ? "restore" : "archive";
  if (entry.field === "deleted") return "delete";
  if (entry.field === "rejectionReason") return "reject";
  if (entry.field === "status") {
    if (entry.newValue === "Опубликовано") return "publish";
    if (entry.newValue === "Отклонено") return "reject";
    if (entry.newValue === "На модерации") return "submit";
    if (entry.newValue === "Отменено") return "cancel";
    return "status";
  }
  if (entry.entityType === "CATEGORY" && (entry.field === "name" || entry.field === "slug")) {
    return entry.oldValue === "—" ? "create" : "update";
  }
  if (entry.entityType === "USER" && entry.field === "group") return "update";
  return "update";
}

export function getAuditActionLabel(entry: Pick<CampusAuditEntry, "field" | "entityType" | "newValue" | "oldValue">) {
  const key = getAuditActionKey(entry);
  const labels: Record<string, string> = {
    create: "Создание",
    update: "Изменение",
    archive: "Архивация",
    restore: "Восстановление",
    block: "Блокировка",
    unblock: "Разблокировка",
    role: "Смена роли",
    publish: "Публикация",
    reject: "Отклонение",
    submit: "Отправка на модерацию",
    cancel: "Отмена / закрытие",
    delete: "Удаление",
    status: "Изменение статуса",
  };
  return labels[key] ?? "Изменение";
}

export function filterAuditEntries(
  entries: CampusAuditEntry[],
  filters: AuditHistoryFilters,
) {
  const q = (filters.q ?? "").trim().toLowerCase();
  const from = filters.from ? new Date(filters.from) : null;
  const to = filters.to ? new Date(filters.to) : null;

  return entries.filter((entry) => {
    if (filters.type && getAuditEntityType(entry) !== filters.type) return false;
    if (filters.entityId && entry.entityId !== filters.entityId) return false;
    if (filters.action && filters.action !== "all" && getAuditActionKey(entry) !== filters.action) return false;
    if (filters.actor && filters.actor !== "all") {
      const actorRole = (entry as CampusAuditEntry & { actorRole?: string }).actorRole ?? "ADMIN";
      if (actorRole !== filters.actor) return false;
    }
    const occurredAt = new Date(entry.occurredAt);
    if (from && occurredAt < from) return false;
    if (to && occurredAt > to) return false;
    if (!q) return true;

    const searchText = [
      entry.entityLabel,
      entry.actorName,
      entry.field,
      entry.oldValue,
      entry.newValue,
      getAuditActionLabel(entry),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return searchText.includes(q);
  });
}
