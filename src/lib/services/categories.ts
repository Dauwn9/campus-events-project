import { randomUUID } from "node:crypto";
import { readStore, changeStore } from "./demo-store";
import { requireRole } from "@/lib/auth";
import {
  categoryInputSchema,
  type CategoryInput,
} from "@/lib/validators/category";
import { ServiceError, USE_MOCKS } from "./errors";
import { getPrisma } from "@/lib/prisma";

const cyrillicToLatin: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh",
  з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o",
  п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts",
  ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu",
  я: "ya",
};

export function makeCategorySlug(value: string) {
  return value
    .toLowerCase()
    .split("")
    .map((character) => cyrillicToLatin[character] ?? character)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function toCategory(category: {
  id: string;
  name: string;
  slug: string;
  archivedAt: Date | null;
}) {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    archivedAt: category.archivedAt?.toISOString() ?? null,
  };
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

export async function getCategories() {
  if (!USE_MOCKS) {
    const categories = await getPrisma().category.findMany({
      where: { archivedAt: null },
      orderBy: { name: "asc" },
    });
    return categories.map(toCategory);
  }
  return readStore().categories.filter((category) => !category.archivedAt);
}
export async function getCategoryById(id: string) {
  if (!USE_MOCKS) {
    const category = await getPrisma().category.findUnique({ where: { id } });
    return category ? toCategory(category) : null;
  }
  return readStore().categories.find((c) => c.id === id) ?? null;
}
export async function getCategoryBySlug(slug: string) {
  if (!USE_MOCKS) {
    const category = await getPrisma().category.findUnique({
      where: { slug },
    });
    return category && !category.archivedAt ? toCategory(category) : null;
  }
  return readStore().categories.find((c) => c.slug === slug) ?? null;
}
export async function createCategory(input: CategoryInput) {
  const actor = await requireRole("ADMIN");
  const parsed = categoryInputSchema.parse(input);
  if (!USE_MOCKS) {
    const duplicate = await getPrisma().category.findFirst({
      where: {
        OR: [
          { name: { equals: parsed.name, mode: "insensitive" } },
          { slug: parsed.slug },
        ],
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new ServiceError("ALREADY_EXISTS", "Категория уже существует");
    }

    try {
      const category = await getPrisma().category.create({
        data: { name: parsed.name, slug: parsed.slug },
      });
      return toCategory(category);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ServiceError("ALREADY_EXISTS", "Категория уже существует");
      }
      throw error;
    }
  }
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
  if (!USE_MOCKS) {
    const category = await getPrisma().category.findUnique({ where: { id } });
    if (!category) return null;
    if (category.archivedAt) {
      throw new ServiceError(
        "FORBIDDEN",
        "Сначала восстановите категорию из архива.",
      );
    }
    if (parsed.name) {
      const duplicate = await getPrisma().category.findFirst({
        where: {
          id: { not: id },
          OR: [
            { name: { equals: parsed.name, mode: "insensitive" } },
            { slug: parsed.slug },
          ],
        },
        select: { id: true },
      });
      if (duplicate) {
        throw new ServiceError("ALREADY_EXISTS", "Категория уже существует");
      }
    }

    try {
      const updated = await getPrisma().category.update({
        where: { id },
        data: {
          ...(parsed.name ? { name: parsed.name } : {}),
          ...(parsed.slug ? { slug: parsed.slug } : {}),
        },
      });
      return toCategory(updated);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ServiceError("ALREADY_EXISTS", "Категория уже существует");
      }
      throw error;
    }
  }
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
  if (!USE_MOCKS) {
    return getPrisma().$transaction(async (transaction) => {
      const category = await transaction.category.findUnique({
        where: { id },
      });
      if (!category) {
        throw new ServiceError("NOT_FOUND", "Категория не найдена.");
      }
      if (category.archivedAt) {
        throw new ServiceError(
          "FORBIDDEN",
          "Категория уже находится в архиве.",
        );
      }
      // Как и в демо-режиме, архивные события не мешают архивировать категорию.
      const eventCount = await transaction.event.count({
        where: { categoryId: id, archivedAt: null },
      });
      if (eventCount > 0) {
        throw new ServiceError(
          "CATEGORY_IN_USE",
          "Сначала архивируйте или перенесите события этой категории.",
        );
      }
      return toCategory(
        await transaction.category.update({
          where: { id },
          data: { archivedAt: new Date() },
        }),
      );
    });
  }
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
  if (!USE_MOCKS) {
    const category = await getPrisma().category.findUnique({ where: { id } });
    if (!category) {
      throw new ServiceError("NOT_FOUND", "Категория не найдена.");
    }
    if (!category.archivedAt) {
      throw new ServiceError(
        "FORBIDDEN",
        "Категория не находится в архиве.",
      );
    }
    return toCategory(
      await getPrisma().category.update({
        where: { id },
        data: { archivedAt: null },
      }),
    );
  }
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
  if (!USE_MOCKS) {
    const categories = await getPrisma().category.findMany({
      include: { _count: { select: { events: true } } },
      orderBy: { name: "asc" },
    });
    return categories.map((category) => ({
      ...toCategory(category),
      eventCount: category._count.events,
    }));
  }
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
  if (!USE_MOCKS) {
    const categories = await getPrisma().category.findMany({
      where: { archivedAt: { not: null } },
      orderBy: { archivedAt: "desc" },
    });
    return categories.map(toCategory);
  }
  return readStore().categories.filter((category) => Boolean(category.archivedAt));
}
