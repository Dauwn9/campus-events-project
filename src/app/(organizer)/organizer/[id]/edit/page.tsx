import { notFound } from "next/navigation";
import EventForm from "@/components/features/events/EventForm";
import { getEventById, getEvents } from "@/lib/services/events";
import { updateEventAction } from "@/app/(organizer)/organizer/actions";

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const event = await getEventById(id);
  if (!event) notFound();

  const events = await getEvents();
  const categoryIds = [...new Set(events.map((e) => e.categoryId))];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Редактировать событие</h1>
      <EventForm
        action={updateEventAction.bind(null, event.id)}
        event={event}
        categoryIds={categoryIds}
        submitLabel="Сохранить"
      />
    </div>
  );
}