"use client";

type Props = {
  title: string;
  text: string;
  onRetry?: () => void;
};

export default function ErrorState({ title, text, onRetry }: Props) {
  return (
    <div
      role="alert"
      className="space-y-3 rounded-lg border border-red-300 p-6 text-center"
    >
      <h2 className="text-lg font-semibold text-red-700">{title}</h2>
      <p className="text-sm text-muted">{text}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-control bg-primary px-4 py-2 text-white hover:bg-primary-hover"
        >
          Повторить
        </button>
      )}
    </div>
  );
}