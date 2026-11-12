import {
  archiveCategoryAction,
  createCategoryAction,
  updateCategoryAction,
} from "@/app/admin-actions";
import Link from "next/link";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import Input from "@/components/ui/Input";
import Icon from "@/components/ui/Icon";
import { getAdminCategories } from "@/lib/services/categories";
import { PageHeading, Stats } from "@/components/workspace/WorkspaceUI";
import HistoryLinkButton from "@/components/admin/HistoryLinkButton";

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
  const archivedCount = allCategories.length - categories.length;
  const eventCount = categories.reduce(
    (total, category) => total + category.eventCount,
    0,
  );
  const errorMessage = query.error ? errors[query.error] : undefined;
  const successMessage = query.success ? successes[query.success] : undefined;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeading
        eyebrow="АДМИН-ПАНЕЛЬ / СПРАВОЧНИК"
        title="Категории"
        text="Настраивайте направления мероприятий. Перед архивированием категории сначала архивируйте или перенесите её активные события."
        action={
          <Link
            className="workspace-button secondary"
            href="/admin/archive?tab=categories"
          >
            <Icon name="grid" size={16} />
            Архив
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs">
              {archivedCount}
            </span>
          </Link>
        }
      />

      <Stats
        items={[
          { label: "Активных категорий", value: categories.length },
          { label: "Событий в категориях", value: eventCount },
          { label: "В архиве", value: archivedCount },
        ]}
      />

      {errorMessage && (
        <p
          role="alert"
          className="rounded-control border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          {errorMessage}
        </p>
      )}
      {successMessage && (
        <p
          role="status"
          className="rounded-control border border-green-200 bg-green-50 p-3 text-sm text-green-800"
        >
          {successMessage}
        </p>
      )}

      <section className="workspace-panel overflow-hidden">
        <div className="flex items-start gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-control bg-primary/10 text-primary">
            <Icon name="spark" size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold">Новое направление</h2>
            <p className="mt-1 text-sm text-muted">
              Добавьте категорию, чтобы организаторам было проще классифицировать события.
            </p>
            <form
              action={createCategoryAction}
              className="mt-4 flex flex-col gap-3 sm:flex-row"
            >
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
                className="min-h-11 bg-white sm:max-w-md"
              />
              <Button type="submit" className="min-h-11 shrink-0">
                Добавить категорию
              </Button>
            </form>
          </div>
        </div>
      </section>

      {categories.length === 0 ? (
        <section className="workspace-panel">
          <EmptyState
            title="Активных категорий пока нет"
            text="Добавьте новое направление выше или восстановите категорию из архива."
          />
        </section>
      ) : (
        <section aria-labelledby="category-list-heading">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h2
                id="category-list-heading"
                className="text-lg font-semibold"
              >
                Активные категории
              </h2>
              <p className="mt-1 text-sm text-muted">
                Переименуйте направление или переместите его в архив.
              </p>
            </div>
            <span className="shrink-0 text-sm text-muted">
              {categories.length} всего
            </span>
          </div>
          <ul className="grid gap-3">
            {categories.map((category, index) => (
              <li key={category.id}>
                <article className="group rounded-card border border-border bg-surface p-4 shadow-card transition hover:border-primary/25 hover:shadow-md sm:p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                    <span className="grid size-11 shrink-0 place-items-center rounded-control bg-primary/5 font-semibold text-primary">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0 flex-1">
                      <form
                        action={updateCategoryAction}
                        className="flex flex-col gap-2 sm:flex-row"
                      >
                        <input
                          type="hidden"
                          name="id"
                          value={category.id}
                        />
                        <label
                          htmlFor={`category-${category.id}`}
                          className="sr-only"
                        >
                          Название категории {category.name}
                        </label>
                        <Input
                          id={`category-${category.id}`}
                          name="name"
                          required
                          minLength={2}
                          maxLength={50}
                          defaultValue={category.name}
                          className="min-h-11 bg-white font-medium"
                        />
                        <Button
                          type="submit"
                          className="min-h-11 shrink-0 sm:min-w-28"
                        >
                          Сохранить
                        </Button>
                      </form>
                      <p className="mt-2 flex items-center gap-1.5 text-xs text-muted">
                        <Icon name="people" size={14} />
                        {category.eventCount}{" "}
                        {category.eventCount === 1 ? "событие" : "событий"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <HistoryLinkButton entityType="CATEGORY" entityId={category.id} />
                      <form action={archiveCategoryAction}>
                        <input type="hidden" name="id" value={category.id} />
                        <Button
                          type="submit"
                          className="workspace-button secondary danger min-h-11 w-full sm:w-auto"
                          aria-label={`Архивировать категорию ${category.name}`}
                        >
                          В архив
                        </Button>
                      </form>
                    </div>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
