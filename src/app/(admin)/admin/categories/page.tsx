import {
  archiveCategoryAction,
  createCategoryAction,
  updateCategoryAction,
} from "@/app/admin-actions";
import Link from "next/link";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Input from "@/components/ui/Input";
import { getAdminCategories } from "@/lib/services/categories";

const errors: Record<string, string> = {
  invalid: "Введите название категории длиной от 2 до 50 символов.",
  ALREADY_EXISTS: "Категория с таким названием уже существует.",
  CATEGORY_IN_USE:
    "Сначала архивируйте или перенесите события этой категории.",
  FORBIDDEN: "Сначала восстановите категорию из архива.",
  "not-found": "Категория не найдена.",
};

const successes: Record<string, string> = {
  created: "Категория создана.",
  updated: "Категория обновлена.",
  archived: "Категория перемещена в архив. События и история сохранены.",
};

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const [allCategories, query] = await Promise.all([
    getAdminCategories(),
    searchParams,
  ]);
  const categories = allCategories.filter((category) => !category.archivedAt);
  const errorMessage = query.error ? errors[query.error] : undefined;
  const successMessage = query.success ? successes[query.success] : undefined;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Категории</h1>
        <p className="mt-1 text-sm text-muted">Управление категориями мероприятий.</p>
      </div>
      <Link className="text-link" href="/admin/archive?tab=categories">
        Архив категорий ({allCategories.length - categories.length}) →
      </Link>

      {errorMessage && (
        <p role="alert" className="rounded-control bg-red-50 p-3 text-sm text-red-800">
          {errorMessage}
        </p>
      )}
      {successMessage && (
        <p role="status" className="rounded-control bg-green-50 p-3 text-sm text-green-800">
          {successMessage}
        </p>
      )}

      <Card>
        <form action={createCategoryAction} className="flex flex-col gap-3 sm:flex-row">
          <label htmlFor="new-category-name" className="sr-only">
            Название новой категории
          </label>
          <Input
            id="new-category-name"
            name="name"
            required
            minLength={2}
            maxLength={50}
            placeholder="Например, Волонтёрство"
          />
          <Button type="submit" className="shrink-0">
            Добавить категорию
          </Button>
        </form>
      </Card>

      {categories.length === 0 ? (
        <EmptyState title="Категорий пока нет" text="Добавьте первую категорию выше." />
      ) : (
        <ul className="space-y-3">
          {categories.map((category) => (
            <li key={category.id}>
              <Card className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <form action={updateCategoryAction} className="flex flex-1 gap-3">
                  <input type="hidden" name="id" value={category.id} />
                  <label htmlFor={`category-${category.id}`} className="sr-only">
                    Название категории
                  </label>
                  <Input
                    id={`category-${category.id}`}
                    name="name"
                    required
                    minLength={2}
                    maxLength={50}
                    defaultValue={category.name}
                  />
                  <Button type="submit" className="shrink-0">
                    Сохранить
                  </Button>
                </form>
                <span className="text-sm text-muted">
                  {category.eventCount} событий
                </span>
                <form action={archiveCategoryAction}>
                  <input type="hidden" name="id" value={category.id} />
                  <Button
                    type="submit"
                    className="w-full bg-red-700 hover:bg-red-800 sm:w-auto"
                    aria-label={`Архивировать категорию ${category.name}`}
                  >
                    В архив
                  </Button>
                </form>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
