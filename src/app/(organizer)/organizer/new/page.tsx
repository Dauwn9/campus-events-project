import EventForm from "@/components/features/events/EventForm";
import { getEvents } from "@/lib/services/events";
import { createEventAction } from "@/app/(organizer)/organizer/actions";

export default async function NewEventPage() {
  const events = await getEvents();
  const categoryIds = [...new Set(events.map((e) => e.categoryId))];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Создать событие</h1>
      <EventForm
        action={createEventAction}
        categoryIds={categoryIds}
        submitLabel="Создать"
      />
    </div>
  );
}