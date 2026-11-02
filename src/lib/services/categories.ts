import { mockCategories } from "@/lib/mocks/categories";
import { categoryInputSchema } from "@/lib/validators/category";
import type { Category, CategoryInput } from "@/lib/validators/category";
import { ServiceError, USE_MOCKS } from "./errors";
import { getEvents } from "./events";

let categories: Category[] = [...mockCategories];

const notReady = (): never => {
  throw new ServiceError("INTERNAL", "Реальный сервис категорий ещё не подключён");
};

export async function getCategories(): Promise<Category[]> {
  if (!USE_MOCKS) return notReady();
  return categories;
}

export async function getCategoryById(id: string): Promise<Category | null> {
  if (!USE_MOCKS) return notReady();
  return categories.find((c) => c.id === id) ?? null;
}

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  if (!USE_MOCKS) return notReady();
  return categories.find((c) => c.slug === slug) ?? null;
}

export async function createCategory(input: CategoryInput): Promise<Category> {
  if (!USE_MOCKS) return notReady();
  const validatedInput = categoryInputSchema.parse(input);
  if (
    categories.some(
      (category) =>
        category.name.toLowerCase() === validatedInput.name.toLowerCase() ||
        category.slug === validatedInput.slug,
    )
  ) {
    throw new ServiceError("ALREADY_EXISTS", "Категория с таким названием уже существует");
  }
  const category: Category = {
    ...validatedInput,
    id: `cat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  };
  categories = [...categories, category];
  return category;
}

export async function updateCategory(
  id: string,
  input: Partial<CategoryInput>,
): Promise<Category | null> {
  if (!USE_MOCKS) return notReady();
  const current = categories.find((c) => c.id === id);
  if (!current) return null;
  const validatedInput = categoryInputSchema.partial().parse(input);
  if (
    categories.some(
      (category) =>
        category.id !== id &&
        ((validatedInput.name !== undefined &&
          category.name.toLowerCase() === validatedInput.name.toLowerCase()) ||
          (validatedInput.slug !== undefined && category.slug === validatedInput.slug)),
    )
  ) {
    throw new ServiceError("ALREADY_EXISTS", "Категория с таким названием уже существует");
  }
  const updated: Category = { ...current, ...validatedInput };
  categories = categories.map((c) => (c.id === id ? updated : c));
  return updated;
}

export async function deleteCategory(id: string): Promise<boolean> {
  if (!USE_MOCKS) return notReady();
  const events = await getEvents();
  if (events.some((event) => event.categoryId === id)) {
    throw new ServiceError(
      "CATEGORY_IN_USE",
      "Нельзя удалить категорию, в которой есть события",
    );
  }
  const before = categories.length;
  categories = categories.filter((c) => c.id !== id);
  return categories.length < before;
}