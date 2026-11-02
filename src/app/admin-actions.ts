"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { ServiceError } from "@/lib/services/errors";
import {
  createCategory,
  deleteCategory,
  updateCategory,
} from "@/lib/services/categories";
import { createComment } from "@/lib/services/comments";
import { categoryInputSchema } from "@/lib/validators/category";
import { createCommentInputSchema } from "@/lib/validators/comment";

const categoryPath = "/admin/categories";

const cyrillicToLatin: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh",
  з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o",
  п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts",
  ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu",
  я: "ya",
};

function makeSlug(value: string) {
  return value
    .toLowerCase()
    .split("")
    .map((character) => cyrillicToLatin[character] ?? character)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function redirectWithCategoryError(error: unknown): never {
  if (error instanceof ServiceError) {
    redirect(`${categoryPath}?error=${encodeURIComponent(error.code)}`);
  }
  throw error;
}

export async function createCategoryAction(formData: FormData) {
  await requireRole("ADMIN");
  const name = formData.get("name");
  const parsed = categoryInputSchema.safeParse({
    name,
    slug: typeof name === "string" ? makeSlug(name) : "",
  });
  if (!parsed.success) redirect(`${categoryPath}?error=invalid`);

  try {
    await createCategory(parsed.data);
  } catch (error) {
    redirectWithCategoryError(error);
  }
  revalidatePath(categoryPath);
  revalidatePath("/");
  revalidatePath("/events/[id]", "page");
  redirect(`${categoryPath}?success=created`);
}

export async function updateCategoryAction(formData: FormData) {
  await requireRole("ADMIN");
  const id = formData.get("id");
  const name = formData.get("name");
  if (typeof id !== "string" || id.length === 0) {
    redirect(`${categoryPath}?error=not-found`);
  }
  const parsed = categoryInputSchema.safeParse({
    name,
    slug: typeof name === "string" ? makeSlug(name) : "",
  });
  if (!parsed.success) redirect(`${categoryPath}?error=invalid`);

  try {
    const category = await updateCategory(id, parsed.data);
    if (!category) redirect(`${categoryPath}?error=not-found`);
  } catch (error) {
    redirectWithCategoryError(error);
  }
  revalidatePath(categoryPath);
  revalidatePath("/");
  revalidatePath("/events/[id]", "page");
  redirect(`${categoryPath}?success=updated`);
}

export async function deleteCategoryAction(formData: FormData) {
  await requireRole("ADMIN");
  const id = formData.get("id");
  if (typeof id !== "string" || id.length === 0) {
    redirect(`${categoryPath}?error=not-found`);
  }

  try {
    const deleted = await deleteCategory(id);
    if (!deleted) redirect(`${categoryPath}?error=not-found`);
  } catch (error) {
    redirectWithCategoryError(error);
  }
  revalidatePath(categoryPath);
  revalidatePath("/");
  revalidatePath("/events/[id]", "page");
  redirect(`${categoryPath}?success=deleted`);
}

export async function addCommentAction(formData: FormData) {
  const user = await requireRole("STUDENT");
  const eventId = formData.get("eventId");
  const parsed = createCommentInputSchema.safeParse({
    eventId,
    text: formData.get("text"),
  });
  if (!parsed.success) {
    const safeEventId = typeof eventId === "string" ? eventId : "";
    redirect(`/events/${encodeURIComponent(safeEventId)}?commentError=invalid`);
  }

  await createComment({
    ...parsed.data,
    userId: user.id,
    userName: user.name,
  });
  const eventPath = `/events/${encodeURIComponent(parsed.data.eventId)}`;
  revalidatePath(eventPath);
  redirect(`${eventPath}?commentStatus=added`);
}
