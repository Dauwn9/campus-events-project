"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createEvent, updateEvent, deleteEvent } from "@/lib/services/events";
import { eventInputSchema } from "@/lib/validators/event";

type State = { error?: string; values?: Record<string, string> };

const LABELS: Record<string, string> = {
  title: "Название (от 3 символов)",
  description: "Описание (от 10 символов)",
  location: "Место",
  startsAt: "Начало",
  endsAt: "Окончание",
  capacity: "Количество мест",
  categoryId: "Категория",
  imageUrl: "Ссылка на картинку",
};

// "2026-11-20T18:00" (время Астаны, UTC+5) -> ISO-строка в UTC
function toIso(value: FormDataEntryValue | null) {
  const v = String(value ?? "");
  if (!v) return "";
  const d = new Date(`${v}:00+05:00`);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

function text(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function parse(formData: FormData, organizerId: string) {
  return eventInputSchema.safeParse({
    title: text(formData, "title"),
    description: text(formData, "description"),
    location: text(formData, "location"),
    startsAt: toIso(formData.get("startsAt")),
    endsAt: toIso(formData.get("endsAt")),
    capacity: Number(formData.get("capacity")),
    categoryId: text(formData, "categoryId"),
    organizerId,
    status: text(formData, "status") || "DRAFT",
    imageUrl: text(formData, "imageUrl") || undefined,
  });
}

function rawValues(formData: FormData) {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") values[key] = value;
  }
  return values;
}

function errorState(
  result: ReturnType<typeof parse>,
  formData: FormData,
): State {
  if (result.success) return {};
  const issue = result.error.issues[0];
  const field = String(issue.path[0] ?? "");
  const error =
    issue.code === "custom"
      ? issue.message
      : `Проверьте поле «${LABELS[field] ?? field}»`;
  return { error, values: rawValues(formData) };
}

export async function createEventAction(
  _prev: State,
  formData: FormData,
): Promise<State> {
  const user = await requireRole("ORGANIZER");
  const result = parse(formData, user.id);
  if (!result.success) return errorState(result, formData);

  await createEvent(result.data);
  revalidatePath("/");
  revalidatePath("/organizer");
  redirect("/organizer");
}

export async function updateEventAction(
  id: string,
  _prev: State,
  formData: FormData,
): Promise<State> {
  const user = await requireRole("ORGANIZER");
  const result = parse(formData, user.id);
  if (!result.success) return errorState(result, formData);

  await updateEvent(id, result.data);
  revalidatePath("/");
  revalidatePath("/organizer");
  revalidatePath(`/events/${id}`);
  redirect("/organizer");
}

export async function deleteEventAction(id: string) {
  await requireRole("ORGANIZER");
  await deleteEvent(id);
  revalidatePath("/");
  revalidatePath("/organizer");
}