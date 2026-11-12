import Link from "next/link";
import QRCode from "qrcode";
import { ticketQROptions } from "@/lib/qr";
import { getMyRegistrations } from "@/lib/services/registrations";
import {
  PageHeading,
  Stats,
  Status,
  Empty,
} from "@/components/workspace/WorkspaceUI";
import StudentEventCard from "@/components/workspace/StudentEventCard";
import ActionForm from "@/components/workspace/ActionForm";
import { cancelRegistrationAction } from "@/app/campus-actions";
import { datePart } from "@/lib/event-design";
export default async function MyRegistrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ when?: string }>;
}) {
  const query = await searchParams;
  const all = await getMyRegistrations({ when: "all" });
  const now = new Date();
  const when = ["upcoming", "past", "all"].includes(query.when ?? "")
    ? query.when!
    : "upcoming";
  const registrations = all.filter(
    (r) =>
      when === "all" ||
      (when === "past"
        ? Date.parse(r.event.endsAt) < now.getTime()
        : Date.parse(r.event.endsAt) >= now.getTime()),
  );
  return (
    <>
      <PageHeading
        eyebrow="ЛИЧНЫЙ КАБИНЕТ / БИЛЕТЫ"
        title="Мои регистрации"
        text="Ваши планы, билеты на вход и история встреч в одном месте."
      />
      <Stats
        items={[
          {
            label: "Предстоящих встреч",
            value: all.filter(
              (r) =>
                r.status === "CONFIRMED" &&
                Date.parse(r.event.endsAt) >= now.getTime(),
            ).length,
          },
          {
            label: "В листе ожидания",
            value: all.filter((r) => r.status === "WAITLIST").length,
          },
          {
            label: "Подтверждённых посещений",
            value: all.filter((r) => r.checkedInAt).length,
          },
        ]}
      />
      <nav className="workspace-tabs" aria-label="Период регистраций">
        {[
          { id: "upcoming", label: "Предстоящие" },
          { id: "past", label: "История" },
          { id: "all", label: "Все записи" },
        ].map((t) => (
          <Link
            key={t.id}
            className={when === t.id ? "active" : ""}
            href={`/my-registrations?when=${t.id}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {registrations.length ? (
        <div className="student-events-list">
          {await Promise.all(
            registrations.map(async (r) => {
              const active =
                r.status === "CONFIRMED" &&
                r.event.status === "PUBLISHED" &&
                Date.parse(r.event.endsAt) >= now.getTime();
              const qr =
                active && r.qrToken
                  ? await QRCode.toDataURL(r.qrToken, ticketQROptions)
                  : null;
              return (
                <StudentEventCard key={r.id} event={r.event}>
                  <div className="registration-status">
                    <Status value={r.status} />
                    {r.checkedInAt && (
                      <span className="attendance-yes">
                        Посещение подтверждено ·{" "}
                        {datePart(r.checkedInAt, {
                          day: "numeric",
                          month: "short",
                        })}
                      </span>
                    )}
                  </div>
                  {qr && (
                    <details className="ticket-details">
                      <summary>
                        Показать QR-билет <span>↗</span>
                      </summary>
                      <div className="ticket">
                        <div>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={qr}
                            alt={`QR-билет на ${r.event.title}`}
                            width={210}
                            height={210}
                          />
                        </div>
                        <div>
                          <span className="section-kicker">
                            КОД ДЛЯ РУЧНОГО ВВОДА
                          </span>
                          <strong>{r.shortCode}</strong>
                          <p>
                            Покажите этот QR организатору на входе. Билет
                            действует один раз и только на это событие.
                          </p>
                          <a href={qr} download={`AIU-ticket-${r.id}.png`}>
                            Скачать QR
                          </a>
                        </div>
                      </div>
                    </details>
                  )}
                  {r.status === "WAITLIST" && (
                    <p className="form-info">
                      Вы в очереди. Если место освободится, запись автоматически
                      подтвердится и здесь появится QR.
                    </p>
                  )}
                  {r.event.status === "CANCELLED" && (
                    <p className="form-error">Организатор отменил событие.</p>
                  )}
                  {r.status !== "CANCELLED" &&
                    !r.checkedInAt &&
                    Date.parse(r.event.startsAt) > now.getTime() && (
                      <ActionForm
                        action={cancelRegistrationAction.bind(null, r.id)}
                        confirm="Отменить вашу запись на это событие?"
                      >
                        <button className="workspace-button secondary danger">
                          Отменить запись
                        </button>
                      </ActionForm>
                    )}
                </StudentEventCard>
              );
            }),
          )}
        </div>
      ) : (
        <Empty
          title="Пока нет встреч в этом разделе"
          text="Выберите событие в афише и запишитесь. Ваш билет появится здесь."
          href="/"
          label="Посмотреть афишу"
        />
      )}
    </>
  );
}
