"use client";
import { useState } from "react";
import { datePart } from "@/lib/event-design";
import { statusLabels } from "@/lib/status";
import Icon from "@/components/ui/Icon";
export type ParticipantRow = {
  id: string;
  name: string;
  email: string;
  group: string;
  status: string;
  checkedInAt: string | null;
  shortCode: string;
};
export default function ParticipantsTable({
  participants,
  eventId,
}: {
  participants: ParticipantRow[];
  eventId: string;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(0);
  const rows = participants.filter(
    (r) =>
      `${r.name} ${r.email} ${r.group} ${r.shortCode}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (filter === "all" ||
        (filter === "checked" && r.checkedInAt) ||
        (filter === "expected" && r.status === "CONFIRMED" && !r.checkedInAt) ||
        (filter === "waitlist" && r.status === "WAITLIST")),
  );
  return (
    <>
      <div className="table-filters">
        <label className="workspace-search">
          <Icon name="search" size={17} />
          <input
            aria-label="Найти участника"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
            placeholder="Имя, группа или код билета"
          />
        </label>
        <select
          aria-label="Фильтр участников"
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value);
            setPage(0);
          }}
        >
          <option value="all">Все участники</option>
          <option value="expected">Ожидаем</option>
          <option value="checked">Пришли</option>
          <option value="waitlist">Лист ожидания</option>
        </select>
        <a
          className="workspace-button secondary"
          href={`/api/organizer/${eventId}/participants`}
        >
          Скачать CSV
        </a>
      </div>
      <div className="workspace-table-wrap">
        <table className="workspace-table">
          <thead>
            <tr>
              <th>Участник</th>
              <th>Группа</th>
              <th>Запись</th>
              <th>Вход</th>
              <th>Код билета</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(page * 25, (page + 1) * 25).map((r) => (
              <tr key={r.id}>
                <td>
                  <strong>{r.name}</strong>
                  <small>{r.email}</small>
                </td>
                <td>{r.group || "—"}</td>
                <td>
                  <span
                    className={`status-tag status-${r.status.toLowerCase()}`}
                  >
                    {statusLabels[r.status]}
                  </span>
                </td>
                <td>
                  {r.checkedInAt ? (
                    <span className="attendance-yes">
                      {datePart(r.checkedInAt, {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      · Пришёл
                    </span>
                  ) : (
                    "Не отмечен"
                  )}
                </td>
                <td>
                  <code>{r.status === "CONFIRMED" ? r.shortCode : "—"}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && (
        <p className="table-empty">
          Участники не найдены. Регистрации появятся после записи студентов.
        </p>
      )}
      <div className="table-pagination">
        <span>Найдено: {rows.length}</span>
        <button disabled={page === 0} onClick={() => setPage(page - 1)}>
          ← Назад
        </button>
        <span>
          {page + 1} / {Math.max(1, Math.ceil(rows.length / 25))}
        </span>
        <button
          disabled={(page + 1) * 25 >= rows.length}
          onClick={() => setPage(page + 1)}
        >
          Далее →
        </button>
      </div>
    </>
  );
}
