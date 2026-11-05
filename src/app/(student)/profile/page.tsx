import { requireRole } from "@/lib/auth";
import { readStore } from "@/lib/services/demo-store";
import { PageHeading, Stats, Panel } from "@/components/workspace/WorkspaceUI";
import ActionForm from "@/components/workspace/ActionForm";
import { profileAction, logoutAction } from "@/app/campus-actions";
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
          <ActionForm action={profileAction} className="profile-form">
            <label>
              Имя и фамилия
              <input
                name="name"
                defaultValue={user.name}
                required
                minLength={2}
                maxLength={80}
              />
            </label>
            <label>
              Email
              <input value={user.email} disabled readOnly />
            </label>
            <div className="form-grid">
              <label>
                Учебная группа
                <input name="group" defaultValue={user.group} maxLength={40} />
              </label>
              <label>
                Высшая школа
                <input
                  name="school"
                  defaultValue={user.school}
                  maxLength={120}
                />
              </label>
            </div>
            <div className="form-section">
              <h3>Изменить пароль</h3>
              <p>Оставьте поля пустыми, чтобы сохранить текущий пароль.</p>
            </div>
            <label>
              Текущий пароль
              <input
                type="password"
                name="currentPassword"
                autoComplete="current-password"
                maxLength={128}
              />
            </label>
            <label>
              Новый пароль
              <input
                type="password"
                name="password"
                minLength={8}
                maxLength={128}
                autoComplete="new-password"
              />
            </label>
            <button className="workspace-button">Сохранить профиль</button>
          </ActionForm>
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
