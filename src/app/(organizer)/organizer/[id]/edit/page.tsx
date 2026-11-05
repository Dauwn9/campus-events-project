import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getCategories } from "@/lib/services/categories";
import { getEventById } from "@/lib/services/events";
import { PageHeading } from "@/components/workspace/WorkspaceUI";
import EventForm from "@/components/workspace/EventForm";
export default async function EditEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireRole("ORGANIZER");
  const { id } = await params;
  const event = await getEventById(id);
  if (!event || event.organizerId !== user.id) notFound();
  return (
    <>
      <PageHeading
        eyebrow="КАБИНЕТ ОРГАНИЗАТОРА / РЕДАКТИРОВАНИЕ"
        title="Обновить событие"
        text="После отправки изменения снова проверит администратор."
      />
      <EventForm categories={await getCategories()} event={event} />
    </>
  );
}
