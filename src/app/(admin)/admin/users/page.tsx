import { requireRole } from "@/lib/auth";
import { readStore } from "@/lib/services/demo-store";
import { PageHeading, Stats } from "@/components/workspace/WorkspaceUI";
import UsersTable from "@/components/workspace/UsersTable";
export default async function UsersPage() {
  await requireRole("ADMIN");
  const users = readStore().users.map(
    ({ id, name, email, role, blocked, group }) => ({
      id,
      name,
      email,
      role,
      blocked,
      group,
    }),
  );
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
      <UsersTable users={users} />
    </>
  );
}
