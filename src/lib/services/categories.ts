import { getPrisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import {
  categoryInputSchema,
  type CategoryInput,
} from "@/lib/validators/category";
import { ServiceError } from "./errors";

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

function throwCategoryConflict(error: unknown): never {
  if (isUniqueConstraintError(error)) {
    throw new ServiceError("ALREADY_EXISTS", "Категория уже существует");
  }
  throw error;
}

export async function getCategories() {
  const categories = await getPrisma().category.findMany({
    where: { archivedAt: null },
    orderBy: { name: "asc" },
  });
  return categories.map(toCategory);
}

export async function getCategoryById(id: string) {
  const category = await getPrisma().category.findUnique({ where: { id } });
  return category ? toCategory(category) : null;
}

export async function getCategoryBySlug(slug: string) {
  const category = await getPrisma().category.findUnique({
    where: { slug },
  });
  return category && !category.archivedAt ? toCategory(category) : null;
}

export async function createCategory(input: CategoryInput) {
  await requireRole("ADMIN");
  const parsed = categoryInputSchema.parse(input);
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
    throwCategoryConflict(error);
  }
}

export async function updateCategory(
  id: string,
  input: Partial<CategoryInput>,
) {
  await requireRole("ADMIN");
  const parsed = categoryInputSchema.partial().parse(input);
  const category = await getPrisma().category.findUnique({ where: { id } });
  if (!category) return null;
  if (category.archivedAt) {
    throw new ServiceError(
      "FORBIDDEN",
      "Сначала восстановите категорию из архива.",
    );
  }

  const duplicateFields = [
    ...(parsed.name
      ? [{ name: { equals: parsed.name, mode: "insensitive" as const } }]
      : []),
    ...(parsed.slug ? [{ slug: parsed.slug }] : []),
  ];
  if (duplicateFields.length > 0) {
    const duplicate = await getPrisma().category.findFirst({
      where: { id: { not: id }, OR: duplicateFields },
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
        ...(parsed.name !== undefined ? { name: parsed.name } : {}),
        ...(parsed.slug !== undefined ? { slug: parsed.slug } : {}),
      },
    });
    return toCategory(updated);
  } catch (error) {
    throwCategoryConflict(error);
  }
}

export async function archiveCategory(id: string) {
  await requireRole("ADMIN");
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
    const activeEvents = await transaction.event.count({
      where: { categoryId: id, archivedAt: null },
    });
    if (activeEvents > 0) {
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

export async function restoreCategory(id: string) {
  await requireRole("ADMIN");
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

export async function getAdminCategories() {
  await requireRole("ADMIN");
  const categories = await getPrisma().category.findMany({
    include: {
      _count: {
        select: { events: { where: { archivedAt: null } } },
      },
    },
    orderBy: { name: "asc" },
  });
  return categories.map((category) => ({
    ...toCategory(category),
    eventCount: category._count.events,
  }));
}

export async function getAdminArchivedCategories() {
  await requireRole("ADMIN");
  const categories = await getPrisma().category.findMany({
    where: { archivedAt: { not: null } },
    orderBy: { archivedAt: "desc" },
  });
  return categories.map(toCategory);
}
