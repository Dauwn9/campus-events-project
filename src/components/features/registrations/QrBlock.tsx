"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import Button from "@/components/ui/Button";
import Skeleton from "@/components/ui/Skeleton";

// Кнопка «Показать QR» + белый экран на весь телефон. В QR только токен.
export function QrBlock({ token, eventTitle }: { token: string; eventTitle: string }) {
  const [open, setOpen] = useState(false);
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    QRCode.toDataURL(token, { width: 640, margin: 2, errorCorrectionLevel: "M" })
      .then(setDataUrl)
      .catch(() => setDataUrl(null));
  }, [open, token]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <Button
        type="button"
        onClick={() => setOpen(true)}
        className="min-h-11 font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        Показать QR
      </Button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`QR-код для входа на «${eventTitle}»`}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-white p-6"
        >
          <h2 className="max-w-sm text-center text-xl font-semibold text-gray-900">{eventTitle}</h2>
          {dataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={dataUrl} alt="QR-код для входа" className="aspect-square w-full max-w-sm" />
          ) : (
            <Skeleton className="aspect-square w-full max-w-sm" />
          )}
          <p className="text-center text-sm text-gray-600">Покажите код организатору на входе</p>
          <button
            type="button"
            autoFocus
            onClick={() => setOpen(false)}
            className="min-h-11 rounded-lg border border-gray-300 px-6 py-2 font-medium text-gray-800 hover:bg-gray-50"
          >
            Закрыть
          </button>
        </div>
      )}
    </>
  );
}
