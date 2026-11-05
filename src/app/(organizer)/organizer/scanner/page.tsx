import { requireRole } from "@/lib/auth";
import { readStore } from "@/lib/services/demo-store";
import { PageHeading } from "@/components/workspace/WorkspaceUI";
import Scanner from "@/components/workspace/Scanner";
export default async function ScannerPage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string }>;
}) {
  const actor = await requireRole("ORGANIZER");
  const query = await searchParams;
  const store = readStore();
  const events = store.events
    .filter((e) => e.organizerId === actor.id && e.status === "PUBLISHED")
    .sort(
      (a, b) =>
        Math.abs(Date.parse(a.startsAt) - Date.now()) -
        Math.abs(Date.parse(b.startsAt) - Date.now()),
    )
    .map((e) => ({
      id: e.id,
      title: e.title,
      startsAt: e.startsAt,
      endsAt: e.endsAt,
      registeredCount: e.registeredCount,
      location: e.location,
      checked: store.registrations.filter(
        (r) => r.eventId === e.id && r.checkedInAt,
      ).length,
    }));
  return (
    <>
      <PageHeading
        eyebrow="КАБИНЕТ ОРГАНИЗАТОРА / КОНТРОЛЬ ВХОДА"
        title="Встречаем гостей"
        text="Проверяйте QR-билеты и отмечайте реальную посещаемость."
      />
      <Scanner events={events} initialId={query.event} />
    </>
  );
}
