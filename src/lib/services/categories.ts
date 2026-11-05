import { randomUUID } from "node:crypto";
import { readStore, changeStore } from "./demo-store";
import { requireRole } from "@/lib/auth";
import {
  categoryInputSchema,
  type CategoryInput,
} from "@/lib/validators/category";
import { ServiceError } from "./errors";
export async function getCategories() {
  return readStore().categories;
}
export async function getCategoryById(id: string) {
  return readStore().categories.find((c) => c.id === id) ?? null;
}
export async function getCategoryBySlug(slug: string) {
  return readStore().categories.find((c) => c.slug === slug) ?? null;
}
export async function createCategory(input: CategoryInput) {
  await requireRole("ADMIN");
  const parsed = categoryInputSchema.parse(input);
  return changeStore((store) => {
    if (
      store.categories.some(
        (c) =>
          c.name.toLowerCase() === parsed.name.toLowerCase() ||
          c.slug === parsed.slug,
      )
    )
      throw new ServiceError("ALREADY_EXISTS", "Категория уже существует");
    const category = { ...parsed, id: `cat-${randomUUID()}` };
    store.categories.push(category);
    return category;
  });
}
export async function updateCategory(
  id: string,
  input: Partial<CategoryInput>,
) {
  await requireRole("ADMIN");
  const parsed = categoryInputSchema.partial().parse(input);
  return changeStore((store) => {
    const category = store.categories.find((c) => c.id === id);
    if (!category) return null;
    if (
      store.categories.some(
        (c) =>
          c.id !== id &&
          ((parsed.name &&
            c.name.toLowerCase() === parsed.name.toLowerCase()) ||
            (parsed.slug && c.slug === parsed.slug)),
      )
    )
      throw new ServiceError("ALREADY_EXISTS", "Категория уже существует");
    Object.assign(category, parsed);
    return category;
  });
}
export async function deleteCategory(id: string) {
  await requireRole("ADMIN");
  return changeStore((store) => {
    if (store.events.some((e) => e.categoryId === id))
      throw new ServiceError("CATEGORY_IN_USE", "В категории есть события");
    const before = store.categories.length;
    store.categories = store.categories.filter((c) => c.id !== id);
    return before !== store.categories.length;
  });
}
