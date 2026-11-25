import { requireRole } from "@/lib/auth";
import { getScannerEvents } from "@/lib/services/organizer";
import { PageHeading } from "@/components/workspace/WorkspaceUI";
import Scanner from "@/components/workspace/Scanner";
export default async function ScannerPage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string }>;
}) {
  const actor = await requireRole("ORGANIZER");
  const query = await searchParams;
  const events = await getScannerEvents(actor.id);
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
