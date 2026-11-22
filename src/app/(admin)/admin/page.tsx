import Link from "next/link";
import Icon from "@/components/ui/Icon";
import { getAdminModeration, getAdminOverview } from "@/lib/services/admin";

const metrics = [
  {
    key: "totalEvents",
    label: "Всего событий",
    note: "В каталоге кампуса",
    icon: "calendar",
    color: "violet",
  },
  {
    key: "publishedEvents",
    label: "Опубликовано",
    note: "Доступно студентам",
    icon: "eye",
    color: "cyan",
  },
  {
    key: "totalRegistrations",
    label: "Подтверждённые записи",
    note: "На все мероприятия",
    icon: "people",
    color: "green",
  },
  {
    key: "totalUsers",
    label: "Пользователи",
    note: "Аккаунтов в системе",
    icon: "user",
    color: "gold",
  },
] as const;

export default async function AdminOverviewPage() {
  const [overview, moderation] = await Promise.all([
    getAdminOverview(),
    getAdminModeration(),
  ]);
  const statusItems = [
    {
      label: "Опубликовано",
      value: moderation.counts.published,
      color: "var(--dashboard-cyan)",
    },
    {
      label: "На модерации",
      value: moderation.counts.pending,
      color: "var(--dashboard-gold)",
    },
    {
      label: "Отклонено",
      value: moderation.counts.rejected,
      color: "var(--dashboard-pink)",
    },
  ];
  const statusTotal = statusItems.reduce((sum, item) => sum + item.value, 0);
  const circumference = 2 * Math.PI * 43;
  let chartOffset = 0;
  const statusSegments = statusItems.map((item) => {
    const length =
      statusTotal > 0 ? (item.value / statusTotal) * circumference : 0;
    const segment = { ...item, length, offset: chartOffset };
    chartOffset += length;
    return segment;
  });
  const maxRegistrations = Math.max(
    0,
    ...overview.popularEvents.map((event) => event.registeredCount),
  );
  const pendingCount = moderation.counts.pending;
  const pendingPlural = new Intl.PluralRules("ru").select(pendingCount);
  const pendingMessage =
    pendingPlural === "one"
      ? `${pendingCount} событие ожидает решения модератора.`
      : pendingPlural === "few"
        ? `${pendingCount} события ожидают решения модератора.`
        : `${pendingCount} событий ожидают решения модератора.`;
  const today = new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Almaty",
  }).format(new Date());

  return (
    <div className="admin-dashboard">
      <div className="admin-dashboard-heading">
        <div>
          <p className="admin-eyebrow">
            <span className="admin-live-dot" />
            AIU CAMPUS EVENTS <span>/</span> ОБЗОР
          </p>
          <h1>Панель управления</h1>
          <p>Главное о событиях и активности университетского сообщества.</p>
        </div>
        <time className="admin-dashboard-date">{today}</time>
      </div>

      <section className="admin-welcome-card" aria-label="Сводка модерации">
        <div className="admin-welcome-copy">
          <span className="admin-welcome-kicker">ПРОСТРАНСТВО AIU</span>
          <h2>События, которые объединяют кампус.</h2>
          <p>
            {pendingCount > 0
              ? pendingMessage
              : "Все события проверены. Здесь можно следить за активностью кампуса."}
          </p>
          <Link href="/admin/moderation" className="admin-welcome-action">
            Перейти к модерации
            <Icon name="right" size={16} />
          </Link>
        </div>
        <div className="admin-welcome-count" aria-label="Событий ожидают проверки">
          <span>ОЖИДАЮТ ПРОВЕРКИ</span>
          <strong>{moderation.counts.pending}</strong>
          <span className="admin-welcome-orbit" aria-hidden="true" />
        </div>
      </section>

      <section className="admin-metrics" aria-label="Ключевые показатели">
        {metrics.map((metric) => (
          <article className="admin-metric-card" key={metric.key}>
            <div className="admin-metric-top">
              <span className={`admin-metric-icon ${metric.color}`}>
                <Icon name={metric.icon} size={19} />
              </span>
              <span className="admin-metric-note">{metric.note}</span>
            </div>
            <p>{metric.label}</p>
            <strong>{overview[metric.key].toLocaleString("ru-RU")}</strong>
          </article>
        ))}
      </section>

      <section className="admin-dashboard-grid" aria-label="Аналитика событий">
        <article className="admin-dashboard-card admin-popular-card">
          <div className="admin-card-heading">
            <div>
              <span className="admin-card-kicker">АКТИВНОСТЬ</span>
              <h2>Популярные события</h2>
            </div>
            <Link href="/admin/archive" className="admin-card-link">
              Все события <Icon name="arrow" size={14} />
            </Link>
          </div>
          <p className="admin-card-description">
            Подтверждённые записи для мероприятий с наибольшим интересом.
          </p>
          {overview.popularEvents.length === 0 ? (
            <div className="admin-chart-empty">
              <Icon name="calendar" size={22} />
              <span>Пока нет данных о событиях</span>
            </div>
          ) : (
            <div className="admin-popular-list">
              {overview.popularEvents.map((event, index) => (
                <Link
                  key={event.id}
                  href={`/events/${event.id}`}
                  className="admin-popular-row"
                  aria-label={`${index + 1}. ${event.title}, ${event.registeredCount} подтверждённых записей. Открыть событие`}
                >
                  <span className="admin-popular-rank" aria-hidden="true">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="admin-popular-content">
                    <span className="admin-popular-heading">
                      <span className="admin-popular-label" title={event.title}>
                        {event.title}
                      </span>
                      <strong>
                        {event.registeredCount}
                        <small>зап.</small>
                      </strong>
                    </span>
                    <span className="admin-popular-track" aria-hidden="true">
                      <span
                        className="admin-popular-bar"
                        style={{
                          width: `${
                            maxRegistrations
                              ? (event.registeredCount / maxRegistrations) * 100
                              : 0
                          }%`,
                        }}
                      />
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </article>

        <article className="admin-dashboard-card admin-status-card">
          <div className="admin-card-heading">
            <div>
              <span className="admin-card-kicker">ПУБЛИКАЦИИ</span>
              <h2>Статус событий</h2>
            </div>
            <Link
              href="/admin/moderation"
              className="admin-card-more"
              aria-label="Открыть модерацию"
            >
              <Icon name="arrow" size={15} />
            </Link>
          </div>
          <div className="admin-status-content">
            <div className="admin-status-donut">
              <svg
                viewBox="0 0 120 120"
                role="img"
                aria-label={`Всего событий в статусах модерации: ${statusTotal}`}
              >
                <circle
                  cx="60"
                  cy="60"
                  r="43"
                  fill="none"
                  stroke="var(--dashboard-track)"
                  strokeWidth="10"
                />
                {statusSegments.map((segment) => (
                  <circle
                    key={segment.label}
                    cx="60"
                    cy="60"
                    r="43"
                    fill="none"
                    stroke={segment.color}
                    strokeWidth="10"
                    strokeDasharray={`${segment.length} ${circumference - segment.length}`}
                    strokeDashoffset={-segment.offset}
                    transform="rotate(-90 60 60)"
                  />
                ))}
              </svg>
              <span>
                <strong>{statusTotal}</strong>
                <small>событий</small>
              </span>
            </div>
            <ul className="admin-status-legend">
              {statusItems.map((item) => (
                <li key={item.label}>
                  <span
                    className="admin-status-key"
                    style={{ backgroundColor: item.color }}
                  />
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </li>
              ))}
            </ul>
          </div>
        </article>
      </section>
    </div>
  );
}
