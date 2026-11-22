import { getAdminUsers } from "@/lib/services/admin";
import { requireRole } from "@/lib/auth";
import { PageHeading, Stats } from "@/components/workspace/WorkspaceUI";
import UsersTable from "@/components/workspace/UsersTable";
export default async function UsersPage() {
  const admin = await requireRole("ADMIN");
  const users = await getAdminUsers();
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
        users={users}
      />
    </>
  );
}
