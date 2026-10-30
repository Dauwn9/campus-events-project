export default function Button({
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`rounded-control bg-primary px-4 py-2 text-white hover:bg-primary-hover disabled:opacity-50 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}