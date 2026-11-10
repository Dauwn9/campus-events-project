import { requireRole } from "@/lib/auth";
import { readStore } from "./demo-store";

const fieldLabels: Record<string, string> = {
  title: "Название",
  description: "Описание",
  location: "Место",
  startsAt: "Начало",
  endsAt: "Окончание",
  capacity: "Лимит участников",
  categoryId: "Категория",
  registrationOpensAt: "Открытие записи",
  priorityWindowHours: "Приоритетное окно",
  status: "Статус",
  rejectionReason: "Причина отказа",
  archivedAt: "Архив",
  deleted: "Удаление",
};

const dateFields = [
  "startsAt",
  "endsAt",
  "registrationOpensAt",
  "archivedAt",
];

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Almaty",
});

export function eventHistoryLabel(field: string) {
  return fieldLabels[field] ?? field;
}

export function eventHistoryValue(field: string, value: string) {
  if (!value) return "—";
  if (dateFields.includes(field)) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return dateFormatter.format(date);
  }
  return value;
}

export function formatHistoryDate(value: string) {
  return dateFormatter.format(new Date(value));
}

export async function getOrganizerEventHistory(eventId: string) {
  const user = await requireRole("ORGANIZER");
  const store = readStore();
  const own = store.events.some(
    (e) => e.id === eventId && e.organizerId === user.id,
  );
  if (!own) return [];
  return store.auditLog
    .filter((e) => e.entityType === "EVENT" && e.entityId === eventId)
    .slice(-50)
    .reverse();
}