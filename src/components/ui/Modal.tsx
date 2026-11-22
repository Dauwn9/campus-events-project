"use client";

export default function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div
      className="admin-modal-backdrop fixed inset-0 z-40 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className="admin-modal-surface max-h-[90vh] w-full max-w-md overflow-y-auto rounded-card border border-border bg-surface p-6 text-text shadow-modal"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === "Escape") onClose();
        }}
      >
        <header className="mb-5 flex items-center justify-between gap-4">
          <h2 id="modal-title" className="text-xl font-bold">
            {title}
          </h2>
          <button
            type="button"
            className="rounded-control px-3 py-2 text-sm text-muted hover:bg-muted/10"
            onClick={onClose}
            aria-label="Закрыть окно"
            autoFocus
          >
            Закрыть
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}