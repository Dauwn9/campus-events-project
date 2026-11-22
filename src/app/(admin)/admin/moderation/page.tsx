import Link from "next/link";
import { getAdminModeration } from "@/lib/services/admin";
import { PageHeading, Stats } from "@/components/workspace/WorkspaceUI";
import AdminModerationList from "@/components/admin/AdminModerationList";
export default async function ModerationPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const query = await searchParams;
  const { pending, decisions, categories, organizers, counts } =
    await getAdminModeration();
  const tab = query.tab === "history" ? "history" : "pending";
  const events = tab === "pending" ? pending : decisions;
  return (
    <>
      <PageHeading
        eyebrow="АДМИН-ПАНЕЛЬ / ПУБЛИКАЦИИ"
        title="Модерация событий"
        text="Проверьте программу, время и место перед появлением события в афише."
      />
      <Stats
        items={[
          { label: "Ожидают проверки", value: counts.pending },
          { label: "Опубликовано", value: counts.published },
          { label: "Отклонено", value: counts.rejected },
        ]}
      />
      <nav className="workspace-tabs" aria-label="Очередь модерации">
        <Link
          className={tab === "pending" ? "active" : ""}
          href="/admin/moderation"
        >
          На проверке · {pending.length}
        </Link>
        <Link
          className={tab === "history" ? "active" : ""}
          href="/admin/moderation?tab=history"
        >
          История решений · {decisions.length}
        </Link>
      </nav>
      <AdminModerationList
        events={events}
        categories={categories}
        organizers={organizers}
        tab={tab}
      />
    </>
  );
}
