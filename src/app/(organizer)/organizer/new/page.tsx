import { requireRole } from "@/lib/auth";
import { getCategories } from "@/lib/services/categories";
import { PageHeading } from "@/components/workspace/WorkspaceUI";
import EventForm from "@/components/workspace/EventForm";
export default async function NewEventPage() {
  // Проверка сессии делает страницу динамической: категории читаются
  // из базы при каждом запросе, а не замораживаются при сборке.
  await requireRole("ORGANIZER");
  return (
    <>
      <PageHeading
        eyebrow="КАБИНЕТ ОРГАНИЗАТОРА / НОВОЕ СОБЫТИЕ"
        title="Создать событие"
        text="Соберите людей вокруг своей идеи. Мы поможем с остальным."
      />
      <EventForm categories={await getCategories()} />
    </>
  );
}
