import { requireAnyRole } from "@/lib/auth";
import { readStore } from "@/lib/services/demo-store";
import { USE_MOCKS } from "@/lib/services/errors";
import { getStudentPriorityStatus } from "@/lib/services/campus";
import {
  PageHeading,
  Stats,
  Panel,
  Empty,
} from "@/components/workspace/WorkspaceUI";
import ProfileForm from "@/components/workspace/ProfileForm";
import ProfilePrivacy from "@/components/workspace/ProfilePrivacy";
import { getProfilePrivacy } from "@/lib/services/users";
import StudentEventCard from "@/components/workspace/StudentEventCard";
import { logoutAction } from "@/app/campus-actions";
import { datePart } from "@/lib/event-design";

const roleLabels = {
  STUDENT: "Студент",
  ORGANIZER: "Организатор",
  ADMIN: "Администратор",
} as const;

export default async function ProfilePage() {
  const user = await requireAnyRole("STUDENT", "ORGANIZER", "ADMIN");
  const store =
    user.role === "STUDENT" && USE_MOCKS ? readStore() : undefined;
  const hasStudentDemoData =
    user.role === "STUDENT" &&
    store?.users.some((item) => item.id === user.id) === true;
  const regs = hasStudentDemoData
    ? store!.registrations.filter((registration) => registration.userId === user.id)
    : [];
  const visits = regs.filter((registration) => registration.checkedInAt).length;
  const isActive =
    hasStudentDemoData &&
    getStudentPriorityStatus(store!, user.id) === "ACTIVE";
  const history = regs
    .filter((registration) => registration.checkedInAt)
    .flatMap((registration) => {
      const event = store!.events.find(
        (item) => item.id === registration.eventId,
      );
      if (!event) return [];
      return [{ ...registration, event }];
    })
    .sort(
      (a, b) =>
        new Date(b.checkedInAt ?? 0).getTime() -
        new Date(a.checkedInAt ?? 0).getTime(),
    );

  return (
    <>
      <PageHeading
        eyebrow="ЛИЧНЫЙ КАБИНЕТ / ПРОФИЛЬ"
        title={`Привет, ${user.name.split(" ")[0]}`}
        text="Управляйте личными данными и паролем."
      />
      {hasStudentDemoData && (
        <Stats
          items={[
            { label: "Посещено событий", value: visits },
            {
              label: "Статус участника",
              value: isActive ? "Активный" : "Стандартный",
              note: isActive
                ? "Доступна приоритетная запись"
                : "Активный статус — после 3 посещений",
            },
            {
              label: "Ваши регистрации",
              value: regs.filter((registration) => registration.status !== "CANCELLED").length,
            },
          ]}
        />
      )}
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
              .map((namePart) => namePart[0])
              .join("")}
          </span>
          <h2>{user.name}</h2>
          <p>{roleLabels[user.role]}</p>
          {hasStudentDemoData && (
            <>
              <span className={`status-tag ${isActive ? "status-active" : ""}`}>
                {isActive ? "Активный" : "Стандартный"}
              </span>
              <div className="priority-progress">
                <span
                  style={{
                    width: `${isActive ? 100 : Math.min(100, (visits / 3) * 100)}%`,
                  }}
                />
              </div>
              <p>
                {isActive
                  ? "Вы активно участвуете в жизни кампуса. Продолжайте открывать новое!"
                  : `До активного статуса осталось ${Math.max(0, 3 - visits)} подтверждённых посещения.`}
              </p>
            </>
          )}
          <ProfilePrivacy
            userId={user.id}
            initialPrivate={await getProfilePrivacy(user.id)}
          />
          <form action={logoutAction}>
            <button className="workspace-button secondary">
              Выйти из аккаунта
            </button>
          </form>
        </aside>
      </div>
      {hasStudentDemoData && (
        <Panel title="История посещений">
          {history.length ? (
            <div className="student-events-list">
              {history.map((item) => (
                <StudentEventCard key={item.event.id} event={item.event}>
                  <div className="registration-status">
                    <span className="status-tag status-confirmed">Посещено</span>
                    <span className="attendance-yes">
                      {datePart(item.checkedInAt!, {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                </StudentEventCard>
              ))}
            </div>
          ) : (
            <Empty
              title="У вас пока нет подтверждённых посещений"
              text="После первого отмеченного входа мероприятия появятся здесь."
              href="/"
              label="Посмотреть афишу"
            />
          )}
        </Panel>
      )}
    </>
  );
}
