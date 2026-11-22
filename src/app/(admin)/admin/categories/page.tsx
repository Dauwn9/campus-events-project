import Link from "next/link";
import Icon from "@/components/ui/Icon";
import { getAdminCategories } from "@/lib/services/categories";
import { PageHeading, Stats } from "@/components/workspace/WorkspaceUI";
import AdminCategoriesManager from "@/components/admin/AdminCategoriesManager";

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
  searchParams: Promise<{
    error?: string;
    success?: string;
    modal?: string;
    category?: string;
  }>;
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
  const initialModal =
    query.modal === "create"
      ? "create"
      : query.modal === "edit" &&
          categories.some((category) => category.id === query.category)
        ? `edit:${query.category}`
        : null;

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

      {errorMessage && !initialModal && (
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

      <AdminCategoriesManager
        key={`${initialModal ?? "closed"}:${query.error ?? ""}`}
        categories={categories}
        initialModal={initialModal}
        errorMessage={initialModal ? errorMessage : undefined}
      />
    </div>
  );
}
