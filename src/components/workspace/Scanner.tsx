"use client";
import {
  useActionState,
  useEffect,
  useRef,
  useState,
  startTransition,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { checkInAction } from "@/app/campus-actions";
import { datePart } from "@/lib/event-design";
import Icon from "@/components/ui/Icon";
type ScannerEvent = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  registeredCount: number;
  checked: number;
  location: string;
};
export default function Scanner({
  events,
  initialId,
}: {
  events: ScannerEvent[];
  initialId?: string;
}) {
  const [eventId, setEventId] = useState(
    events.some((e) => e.id === initialId) ? initialId! : (events[0]?.id ?? ""),
  );
  const [state, action, pending] = useActionState(checkInAction, {});
  const [camera, setCamera] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [code, setCode] = useState("");
  const video = useRef<HTMLVideoElement>(null);
  const media = useRef<MediaStream | null>(null);
  const frame = useRef<number>(0);
  const cameraRun = useRef(0);
  const last = useRef({ code: "", at: 0 });
  const scanning = useRef(false);
  const router = useRouter();
  const event = events.find((e) => e.id === eventId);
  function stopCamera() {
    scanning.current = false;
    cameraRun.current++;
    cancelAnimationFrame(frame.current);
    media.current?.getTracks().forEach((track) => track.stop());
    media.current = null;
    if (video.current) video.current.srcObject = null;
    setCamera(false);
  }
  useEffect(
    () => () => {
      scanning.current = false;
      cameraRun.current++;
      cancelAnimationFrame(frame.current);
      media.current?.getTracks().forEach((track) => track.stop());
    },
    [],
  );
  function submit(value: string) {
    if (!eventId || pending) return;
    const now = Date.now();
    if (last.current.code === value && now - last.current.at < 3000) return;
    last.current = { code: value, at: now };
    const data = new FormData();
    data.set("eventId", eventId);
    data.set("code", value);
    startTransition(() => action(data));
  }
  async function startCamera() {
    setCameraError("");
    scanning.current = true;
    const run = ++cameraRun.current;
    setCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      if (!scanning.current || cameraRun.current !== run) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      media.current = stream;
      const player = video.current!;
      player.srcObject = stream;
      await player.play();
      const { readQR } = await import("@/lib/qr-reader");
      if (!scanning.current || cameraRun.current !== run) return;
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("Canvas unavailable");
      let previousFrame = 0;
      const decodeFrame = (now: number) => {
        if (!scanning.current || cameraRun.current !== run) return;
        if (
          player.readyState >= 2 &&
          player.videoWidth &&
          now - previousFrame > 180
        ) {
          previousFrame = now;
          const ratio = Math.min(1, 960 / player.videoWidth);
          canvas.width = Math.round(player.videoWidth * ratio);
          canvas.height = Math.round(player.videoHeight * ratio);
          context.drawImage(player, 0, 0, canvas.width, canvas.height);
          const image = context.getImageData(0, 0, canvas.width, canvas.height);
          const value = readQR(image.data, image.width, image.height);
          if (value) submit(value);
        }
        frame.current = requestAnimationFrame(decodeFrame);
      };
      frame.current = requestAnimationFrame(decodeFrame);
    } catch {
      stopCamera();
      setCameraError(
        "Не удалось открыть камеру. Разрешите доступ в браузере или используйте код билета / изображение QR.",
      );
    }
  }
  async function readImage(file?: File) {
    if (!file) return;
    setCameraError("");
    if (file.size > 10 * 1024 * 1024) {
      setCameraError("Выберите изображение меньше 10 МБ.");
      return;
    }
    let bitmap: ImageBitmap | undefined;
    try {
      bitmap = await createImageBitmap(file);
      const canvas = document.createElement("canvas");
      const ratio = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
      canvas.width = Math.round(bitmap.width * ratio);
      canvas.height = Math.round(bitmap.height * ratio);
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("Canvas unavailable");
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const { readQR } = await import("@/lib/qr-reader");
      const image = context.getImageData(0, 0, canvas.width, canvas.height);
      const value = readQR(image.data, image.width, image.height);
      if (!value) throw new Error("QR not found");
      submit(value);
    } catch {
      setCameraError(
        "На изображении не удалось прочитать QR. Попробуйте более чёткий снимок или ручной код.",
      );
    } finally {
      bitmap?.close();
    }
  }
  return (
    <div className="workspace-columns scanner-layout">
      <section className="workspace-panel scanner-main">
        <div className="panel-heading">
          <h2>Контроль входа</h2>
          <span className="scanner-live">
            <span /> ГОТОВ К РАБОТЕ
          </span>
        </div>
        <label className="scanner-event-label">
          Ваше опубликованное событие
          <select
            value={eventId}
            onChange={(e) => {
              stopCamera();
              setEventId(e.target.value);
              last.current = { code: "", at: 0 };
            }}
            aria-label="Событие для сканирования"
            disabled={!events.length}
          >
            {!events.length && (
              <option value="">Пока нет опубликованных событий</option>
            )}
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title}
              </option>
            ))}
          </select>
        </label>
        <div className={`camera-stage${camera ? " is-active" : ""}`}>
          <video
            ref={video}
            aria-hidden={!camera}
            muted
            playsInline
            aria-label="Камера QR-сканера"
          />
          {!camera && (
            <div className="camera-placeholder">
              <div className="scan-frame">
                <Icon name="grid" size={58} />
                <i />
              </div>
              <h3>Один QR — и гость на событии</h3>
              <p>
                Наведите камеру на билет студента.
                <br />
                Проверим запись и отметим посещение.
              </p>
              <button
                className="gold-button"
                onClick={startCamera}
                disabled={!eventId}
              >
                Включить камеру <Icon name="arrow" size={17} />
              </button>
            </div>
          )}
          {camera && (
            <button className="camera-stop" onClick={stopCamera}>
              Остановить камеру
            </button>
          )}
        </div>
        {cameraError && (
          <p className="form-error" role="alert">
            {cameraError}
          </p>
        )}
        <label className="qr-upload">
          Или прочитать QR с изображения
          <input
            type="file"
            accept="image/*"
            disabled={!eventId || pending}
            onChange={(e) => {
              void readImage(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
        <div className="manual-divider">
          <span>РУЧНОЙ ВВОД</span>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(code);
          }}
          className="manual-code-form"
        >
          <label>
            <span className="sr-only">Код билета</span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Короткий код или содержимое QR"
              aria-label="Код билета"
              required
              maxLength={500}
            />
          </label>
          <button className="workspace-button" disabled={!eventId || pending}>
            {pending ? "Проверяем…" : "Проверить билет"}
          </button>
        </form>
        {(state.error || state.message) && state.eventId === eventId && (
          <div
            className={`scan-result ${state.error ? "scan-error" : state.kind === "duplicate" ? "scan-duplicate" : "scan-success"}`}
            role={state.error ? "alert" : "status"}
          >
            <strong>{state.error ?? state.message}</strong>
            {state.name && <p>{state.name}</p>}
            {state.at && (
              <small>
                Вход отмечен:{" "}
                {datePart(state.at, {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </small>
            )}
            <button type="button" onClick={() => router.refresh()}>
              Обновить показатели
            </button>
          </div>
        )}
      </section>
      <aside className="scanner-sidebar">
        <section className="workspace-panel">
          <span className="section-kicker">НА ВАШЕМ СОБЫТИИ</span>
          <h2>{event?.title ?? "Сначала опубликуйте событие"}</h2>
          {event ? (
            <>
              <p className="scanner-event-time">
                {datePart(event.startsAt, {
                  day: "numeric",
                  month: "long",
                  hour: "2-digit",
                  minute: "2-digit",
                })}{" "}
                · Астана
              </p>
              <p className="scanner-event-time">{event.location}</p>
              <div className="scanner-numbers">
                <div>
                  <strong>{event.checked}</strong>
                  <span>уже пришли</span>
                </div>
                <div>
                  <strong>
                    {Math.max(0, event.registeredCount - event.checked)}
                  </strong>
                  <span>ожидаем</span>
                </div>
              </div>
              <Link
                href={`/organizer/${event.id}`}
                className="workspace-button secondary"
              >
                Список участников <Icon name="right" size={16} />
              </Link>
              <p className="scanner-window">
                Вход: с{" "}
                {datePart(
                  new Date(Date.parse(event.startsAt) - 3600000).toISOString(),
                  {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  },
                )}{" "}
                до{" "}
                {datePart(event.endsAt, {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                .
              </p>
            </>
          ) : (
            <Link href="/organizer/new" className="workspace-button">
              Создать событие
            </Link>
          )}
        </section>
        <section className="workspace-panel scanner-instructions">
          <h3>Как проходит проверка</h3>
          <div>
            <span className="result-dot green" />
            <p>
              <strong>Проход разрешён</strong>Действительный билет, посещение
              сохранено.
            </p>
          </div>
          <div>
            <span className="result-dot amber" />
            <p>
              <strong>Уже отмечен</strong>Повторный QR не увеличит счётчик.
            </p>
          </div>
          <div>
            <span className="result-dot red" />
            <p>
              <strong>Вход недоступен</strong>Проверьте событие, время и статус
              билета.
            </p>
          </div>
          <p className="scanner-help">
            Камера включается только по кнопке. Если доступа нет, короткий код
            находится под QR в билете студента.
          </p>
        </section>
      </aside>
    </div>
  );
}
