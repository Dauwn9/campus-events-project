import { requireRole } from "@/lib/auth";
import { readStore } from "@/lib/services/demo-store";
import { PageHeading, Stats, Panel } from "@/components/workspace/WorkspaceUI";
import ProfileForm from "@/components/workspace/ProfileForm";
import { logoutAction } from "@/app/campus-actions";
export default async function ProfilePage() {
  const user = await requireRole("STUDENT");
  const regs = readStore().registrations.filter((r) => r.userId === user.id);
  const visits = regs.filter((r) => r.checkedInAt).length;
  return (
    <>
      <PageHeading
        eyebrow="ЛИЧНЫЙ КАБИНЕТ / ПРОФИЛЬ"
        title={`Привет, ${user.name.split(" ")[0]}`}
        text="Ваш университетский профиль и история участия."
      />
      <Stats
        items={[
          { label: "Посещено событий", value: visits },
          {
            label: "Статус участника",
            value: visits >= 3 ? "Активный" : "Стандартный",
            note:
              visits >= 3
                ? "Доступна приоритетная запись"
                : "Активный статус — после 3 посещений",
          },
          {
            label: "Ваши регистрации",
            value: regs.filter((r) => r.status !== "CANCELLED").length,
          },
        ]}
      />
      <div className="workspace-columns">
        <Panel title="Личные данные">
          <ProfileForm
            initialValues={{ name: user.name }}
            email={user.email}
            group={user.group}
            school={user.school}
          />
        </Panel>
        <aside className="workspace-panel profile-side">
          <span className="profile-avatar">
            {user.name
              .split(" ")
              .slice(0, 2)
              .map((n) => n[0])
              .join("")}
          </span>
          <h2>{user.name}</h2>
          <p>Студент · AIU</p>
          <div className="priority-progress">
            <span style={{ width: `${Math.min(100, (visits / 3) * 100)}%` }} />
          </div>
          <p>
            {visits >= 3
              ? "Вы активно участвуете в жизни кампуса. Продолжайте открывать новое!"
              : `До активного статуса осталось ${3 - visits} подтверждённых посещения.`}
          </p>
          <form action={logoutAction}>
            <button className="workspace-button secondary">
              Выйти из аккаунта
            </button>
          </form>
        </aside>
      </div>
    </>
  );
}
