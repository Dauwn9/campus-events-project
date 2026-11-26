import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { getEvents } from "@/lib/services/events";
import { readStore } from "@/lib/services/demo-store";
import { getPrisma } from "@/lib/prisma";
import { USE_MOCKS } from "@/lib/services/errors";
import { PageHeading, Stats } from "@/components/workspace/WorkspaceUI";
import EventTable from "@/components/workspace/EventTable";
import Icon from "@/components/ui/Icon";
export default async function OrganizerPage() {
  const user = await requireRole("ORGANIZER");
  const events = await getEvents({ organizerId: user.id });
  const ids = new Set(events.map((e) => e.id));
  const visits = USE_MOCKS
    ? readStore().registrations.filter(
        (registration) => ids.has(registration.eventId) && registration.checkedInAt,
      ).length
    : await getPrisma().registration.count({
        where: {
          eventId: { in: [...ids] },
          checkedInAt: { not: null },
        },
      });
  return (
    <>
      <PageHeading
        eyebrow="КАБИНЕТ ОРГАНИЗАТОРА"
        title="Мои события"
        text="Всё для вашей следующей встречи: от идеи до последнего гостя."
        action={
          <Link href="/organizer/new" className="workspace-button">
            Создать событие <Icon name="arrow" size={17} />
          </Link>
        }
      />
      <Stats
        items={[
          { label: "Ваши события", value: events.length },
          {
            label: "Опубликовано",
            value: events.filter((e) => e.status === "PUBLISHED").length,
          },
          {
            label: "На модерации",
            value: events.filter((e) => e.status === "PENDING").length,
          },
          { label: "Подтверждённых входов", value: visits },
        ]}
      />
      <EventTable events={events} />
      <div className="workspace-tip">
        <Icon name="spark" size={22} />
        <div>
          <strong>Следующий шаг — ваше событие</strong>
          <p>
            Сохраните идею как черновик или отправьте готовое событие на
            модерацию. Участники и вход по QR доступны в карточке управления.
          </p>
        </div>
        <Link href="/organizer/scanner">Открыть сканер →</Link>
      </div>
    </>
  );
}
