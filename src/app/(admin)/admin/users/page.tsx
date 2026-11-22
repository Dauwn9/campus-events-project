import { getAdminUsers } from "@/lib/services/admin";
import { requireRole } from "@/lib/auth";
import { PageHeading, Stats } from "@/components/workspace/WorkspaceUI";
import UsersTable from "@/components/workspace/UsersTable";
export default async function UsersPage() {
  const admin = await requireRole("ADMIN");
  const users = await getAdminUsers();
  const blockedUntilLabel = (user: (typeof users)[number]) =>
    user.blocked
      ? user.blockedUntil
        ? `До ${new Intl.DateTimeFormat("ru-RU", {
            dateStyle: "medium",
            timeStyle: "short",
            timeZone: "Asia/Almaty",
          }).format(new Date(user.blockedUntil))}`
        : "Без срока"
      : "";
  return (
    <>
      <PageHeading
        eyebrow="АДМИН-ПАНЕЛЬ / УЧАСТНИКИ КАМПУСА"
        title="Пользователи"
        text="Управляйте ролями, назначайте организаторов и контролируйте доступ."
      />
      <Stats
        items={[
          { label: "Всего пользователей", value: users.length },
          {
            label: "Организаторов",
            value: users.filter((u) => u.role === "ORGANIZER").length,
          },
          {
            label: "Заблокировано",
            value: users.filter((u) => u.blocked).length,
          },
        ]}
      />
      <UsersTable
        currentUserId={admin.id}
        users={users.map((user) => ({
          ...user,
          blockedUntilLabel: blockedUntilLabel(user),
        }))}
      />
    </>
  );
}
