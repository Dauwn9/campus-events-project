import { randomUUID } from "node:crypto";
import { readStore, changeStore } from "./demo-store";
import { requireRole } from "@/lib/auth";
import {
  categoryInputSchema,
  type CategoryInput,
} from "@/lib/validators/category";
import { ServiceError } from "./errors";
export async function getCategories() {
  return readStore().categories.filter((category) => !category.archivedAt);
}
export async function getCategoryById(id: string) {
  return readStore().categories.find((c) => c.id === id) ?? null;
}
export async function getCategoryBySlug(slug: string) {
  return readStore().categories.find((c) => c.slug === slug) ?? null;
}
export async function createCategory(input: CategoryInput) {
  const actor = await requireRole("ADMIN");
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
    const category = {
      ...parsed,
      id: `cat-${randomUUID()}`,
      archivedAt: null,
    };
    store.categories.push(category);
    recordCategoryAudit(store, actor, category, [
      { field: "name", oldValue: null, newValue: category.name },
      { field: "slug", oldValue: null, newValue: category.slug },
    ]);
    return category;
  });
}
export async function updateCategory(
  id: string,
  input: Partial<CategoryInput>,
) {
  const actor = await requireRole("ADMIN");
  const parsed = categoryInputSchema.partial().parse(input);
  return changeStore((store) => {
    const category = store.categories.find((c) => c.id === id);
    if (!category) return null;
    if (category.archivedAt)
      throw new ServiceError(
        "FORBIDDEN",
        "Сначала восстановите категорию из архива.",
      );
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
    const changes = (["name", "slug"] as const).flatMap((field) =>
      parsed[field] !== undefined && parsed[field] !== category[field]
        ? [
            {
              field,
              oldValue: category[field],
              newValue: parsed[field],
            },
          ]
        : [],
    );
    Object.assign(category, parsed);
    recordCategoryAudit(store, actor, category, changes);
    return category;
  });
}
function recordCategoryAudit(
  store: ReturnType<typeof readStore>,
  actor: { id: string; name: string },
  category: { id: string; name: string },
  changes: { field: string; oldValue: unknown; newValue: unknown }[],
) {
  const occurredAt = new Date().toISOString();
  for (const change of changes) {
    store.auditLog.push({
      id: randomUUID(),
      occurredAt,
      actorId: actor.id,
      actorName: actor.name,
      entityType: "CATEGORY",
      entityId: category.id,
      entityLabel: `${category.name} (${category.id})`,
      field: change.field,
      oldValue: change.oldValue == null ? "—" : String(change.oldValue),
      newValue: change.newValue == null ? "—" : String(change.newValue),
    });
  }
  store.auditLog = store.auditLog.slice(-1000);
}

export async function archiveCategory(id: string) {
  const actor = await requireRole("ADMIN");
  return changeStore((store) => {
    const category = store.categories.find((item) => item.id === id);
    if (!category) throw new ServiceError("NOT_FOUND", "Категория не найдена.");
    if (category.archivedAt)
      throw new ServiceError(
        "FORBIDDEN",
        "Категория уже находится в архиве.",
      );
    if (
      store.events.some(
        (event) => event.categoryId === id && !event.archivedAt,
      )
    )
      throw new ServiceError(
        "CATEGORY_IN_USE",
        "Сначала архивируйте или перенесите события этой категории.",
      );
    const archivedAt = new Date().toISOString();
    category.archivedAt = archivedAt;
    recordCategoryAudit(store, actor, category, [
      { field: "archivedAt", oldValue: null, newValue: archivedAt },
    ]);
    return category;
  });
}

export async function restoreCategory(id: string) {
  const actor = await requireRole("ADMIN");
  return changeStore((store) => {
    const category = store.categories.find((item) => item.id === id);
    if (!category) throw new ServiceError("NOT_FOUND", "Категория не найдена.");
    if (!category.archivedAt)
      throw new ServiceError(
        "FORBIDDEN",
        "Категория не находится в архиве.",
      );
    const archivedAt = category.archivedAt;
    category.archivedAt = null;
    recordCategoryAudit(store, actor, category, [
      { field: "archivedAt", oldValue: archivedAt, newValue: null },
    ]);
    return category;
  });
}

export async function getAdminCategories() {
  await requireRole("ADMIN");
  const store = readStore();
  return store.categories.map((category) => ({
    ...category,
    eventCount: store.events.filter(
      (event) => event.categoryId === category.id && !event.archivedAt,
    ).length,
  }));
}

export async function getAdminArchivedCategories() {
  await requireRole("ADMIN");
  return readStore().categories.filter((category) => Boolean(category.archivedAt));
}
