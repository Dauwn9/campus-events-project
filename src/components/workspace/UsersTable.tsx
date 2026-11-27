"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import ActionForm from "./ActionForm";
import {
  updateStudentGroupAction,
  updateUserAction,
} from "@/app/campus-actions";
import Icon from "@/components/ui/Icon";
import HistoryLinkButton from "@/components/admin/HistoryLinkButton";
import {
  filterUsersByBanTime,
  formatBanRemaining,
  type BanTimeFilter,
} from "@/lib/admin-filters";
type Row = {
  id: string;
  name: string;
  email: string;
  role: string;
  blocked: boolean;
  blockedUntil: string | null;
  group: string;
};
const roleLabels: Record<string, string> = {
  STUDENT: "Студент",
  ORGANIZER: "Организатор",
  ADMIN: "Администратор",
};

function UserRow({
  user,
  currentUserId,
  now,
}: {
  user: Row;
  currentUserId: string;
  now: number | null;
}) {
  const isCurrentUser = user.id === currentUserId;
  const banRemaining =
    now === null
      ? null
      : formatBanRemaining(user.blocked, user.blockedUntil, now);

  return (
    <article className="user-row">
      <div className="user-identity">
        <span className="user-avatar" aria-hidden="true">
          {user.name
            .split(" ")
            .slice(0, 2)
            .map((n) => n[0])
            .join("")}
        </span>
        <div className="user-info">
          <strong>
            <Link href={`/users/${user.id}`} className="profile-link">
              {user.name}
            </Link>
          </strong>
          <span>{user.email}</span>
          <small>
            Роль: {roleLabels[user.role] ?? user.role} ·{" "}
            {user.group || "Сотрудник / организатор"}
          </small>
          {banRemaining && (
            <small className="user-ban-countdown">
              До разблокировки: {banRemaining}
            </small>
          )}
        </div>
      </div>
      <div className="user-actions-row">
        <HistoryLinkButton entityType="USER" entityId={user.id} />
        <ActionForm
          action={updateUserAction.bind(null, user.id)}
          confirm={(form) => {
            const nextRole = String(form.get("role") ?? user.role);
            if (nextRole === user.role) return;
            return `Изменить роль пользователя ${user.name} (${user.email}) с «${roleLabels[user.role] ?? user.role}» на «${roleLabels[nextRole] ?? nextRole}»?`;
          }}
        >
          <div className="user-permissions">
            <label>
              Роль пользователя
              <select
                key={user.role}
                name="role"
                defaultValue={user.role}
                disabled={isCurrentUser}
              >
                <option value="STUDENT">Студент</option>
                <option value="ORGANIZER">Организатор</option>
                <option value="ADMIN">Администратор</option>
              </select>
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                name="blocked"
                defaultChecked={user.blocked}
                disabled={isCurrentUser}
              />
              Заблокирован
            </label>
            <label>
              Срок блокировки
              <select
                name="banDuration"
                defaultValue={user.blocked ? "keep" : "7d"}
                disabled={isCurrentUser}
              >
                {user.blocked && (
                  <option value="keep">Не менять срок</option>
                )}
                <option value="1d">На 1 день</option>
                <option value="7d">На 7 дней</option>
                <option value="30d">На 30 дней</option>
                <option value="permanent">Навсегда</option>
              </select>
            </label>
            <button
              className="workspace-button secondary"
              aria-label={`Сохранить изменения пользователя ${user.email}`}
              disabled={isCurrentUser}
            >
              Сохранить
            </button>
          </div>
        </ActionForm>
      </div>
      {user.role === "STUDENT" && (
        <ActionForm
          action={updateStudentGroupAction.bind(null, user.id)}
          className="student-group-form"
        >
          <div className="student-group-editor">
            <label htmlFor={`student-group-${user.id}`}>Учебная группа</label>
            <input
              key={user.group}
              id={`student-group-${user.id}`}
              name="group"
              defaultValue={user.group}
              maxLength={40}
            />
            <button
              className="workspace-button secondary"
              aria-label={`Сохранить учебную группу пользователя ${user.email}`}
            >
              Сохранить группу
            </button>
          </div>
        </ActionForm>
      )}
    </article>
  );
}

export default function UsersTable({
  users,
  currentUserId,
}: {
  users: Row[];
  currentUserId: string;
}) {
  const [now, setNow] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("all");
  const [banTime, setBanTime] = useState<BanTimeFilter>("all");
  const [page, setPage] = useState(0);
  useEffect(() => {
    const updateTime = () => setNow(Date.now());
    updateTime();
    const interval = window.setInterval(updateTime, 60_000);
    return () => window.clearInterval(interval);
  }, []);

  const filtered = users.filter(
    (u) =>
      (role === "all" || u.role === role) &&
      (now === null
        ? banTime === "all"
        : filterUsersByBanTime(u, banTime, now)) &&
      `${u.name} ${u.email} ${u.group}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <section className="workspace-panel">
      <div className="table-filters">
        <label className="workspace-search">
          <Icon name="search" size={17} />
          <input
            aria-label="Поиск пользователей"
            placeholder="Имя, email или учебная группа"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
          />
        </label>
        <select
          aria-label="Роль пользователя"
          value={role}
          onChange={(e) => {
            setRole(e.target.value);
            setPage(0);
          }}
        >
          <option value="all">Все роли</option>
          <option value="STUDENT">Студенты</option>
          <option value="ORGANIZER">Организаторы</option>
          <option value="ADMIN">Администраторы</option>
        </select>
        <select
          aria-label="Срок до разблокировки"
          value={banTime}
          onChange={(e) => {
            setBanTime(e.target.value as BanTimeFilter);
            setPage(0);
          }}
        >
          <option value="all">Любой срок блокировки</option>
          <option value="blocked">Все заблокированные</option>
          <option value="within-day">До 24 часов</option>
          <option value="within-week">От 1 до 7 дней</option>
          <option value="over-week">Более 7 дней</option>
          <option value="permanent">Без срока</option>
        </select>
      </div>
      <div
        className="users-list"
        role="region"
        aria-label="Список пользователей"
        tabIndex={0}
      >
        {filtered.slice(page * 15, (page + 1) * 15).map((user) => {
          return (
            <UserRow
              key={user.id}
              user={user}
              currentUserId={currentUserId}
              now={now}
            />
          );
        })}
      </div>
      {!filtered.length && (
        <p className="table-empty">Пользователи не найдены.</p>
      )}
      <div className="table-pagination">
        <span>Найдено: {filtered.length}</span>
        <button disabled={page === 0} onClick={() => setPage(page - 1)}>
          ← Назад
        </button>
        <span>
          {page + 1} / {Math.max(1, Math.ceil(filtered.length / 15))}
        </span>
        <button
          disabled={(page + 1) * 15 >= filtered.length}
          onClick={() => setPage(page + 1)}
        >
          Далее →
        </button>
      </div>
    </section>
  );
}
