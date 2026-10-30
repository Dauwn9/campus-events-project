import { mockCategories } from "@/lib/mocks/categories";
import type { Category, CategoryInput } from "@/lib/validators/category";

let categories: Category[] = [...mockCategories];

export async function getCategories(): Promise<Category[]> {
  return categories;
}

export async function getCategoryById(id: string): Promise<Category | null> {
  return categories.find((c) => c.id === id) ?? null;
}

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  return categories.find((c) => c.slug === slug) ?? null;
}

export async function createCategory(input: CategoryInput): Promise<Category> {
  const category: Category = { ...input, id: `cat-${Date.now()}` };
  categories = [...categories, category];
  return category;
}

export async function updateCategory(
  id: string,
  input: Partial<CategoryInput>,
): Promise<Category | null> {
  const current = categories.find((c) => c.id === id);
  if (!current) return null;
  const updated: Category = { ...current, ...input };
  categories = categories.map((c) => (c.id === id ? updated : c));
  return updated;
}

export async function deleteCategory(id: string): Promise<boolean> {
  const before = categories.length;
  categories = categories.filter((c) => c.id !== id);
  return categories.length < before;
}