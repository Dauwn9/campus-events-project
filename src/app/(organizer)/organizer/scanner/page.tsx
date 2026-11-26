import { requireRole } from "@/lib/auth";
import { readStore } from "@/lib/services/demo-store";
import { getPrisma } from "@/lib/prisma";
import { USE_MOCKS } from "@/lib/services/errors";
import { PageHeading } from "@/components/workspace/WorkspaceUI";
import Scanner from "@/components/workspace/Scanner";
export default async function ScannerPage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string }>;
}) {
  const actor = await requireRole("ORGANIZER");
  const query = await searchParams;
  const now = new Date();
  const events = USE_MOCKS
    ? (() => {
        const store = readStore();
        return store.events
          .filter((event) => event.organizerId === actor.id && event.status === "PUBLISHED")
          .sort(
            (a, b) =>
              Math.abs(Date.parse(a.startsAt) - now.getTime()) -
              Math.abs(Date.parse(b.startsAt) - now.getTime()),
          )
          .map((event) => ({
            id: event.id,
            title: event.title,
            startsAt: event.startsAt,
            endsAt: event.endsAt,
            registeredCount: event.registeredCount,
            location: event.location,
            checked: store.registrations.filter(
              (registration) => registration.eventId === event.id && registration.checkedInAt,
            ).length,
          }));
      })()
    : await getPrisma().event.findMany({
        where: {
          organizerId: actor.id,
          status: "PUBLISHED",
          archivedAt: null,
        },
        select: {
          id: true,
          title: true,
          startsAt: true,
          endsAt: true,
          location: true,
          registrations: {
            where: { status: "CONFIRMED" },
            select: { checkedInAt: true },
          },
        },
      }).then((rows) =>
        rows
          .sort(
            (a, b) =>
              Math.abs(a.startsAt.getTime() - now.getTime()) -
              Math.abs(b.startsAt.getTime() - now.getTime()),
          )
          .map((event) => ({
            id: event.id,
            title: event.title,
            startsAt: event.startsAt.toISOString(),
            endsAt: event.endsAt.toISOString(),
            location: event.location,
            registeredCount: event.registrations.length,
            checked: event.registrations.filter((registration) => registration.checkedInAt).length,
          })),
      );
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
