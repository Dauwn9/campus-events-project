export default function Input({
  className = "",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full rounded-control border border-border px-3 py-2 outline-none focus:border-primary ${className}`}
      {...props}
    />
  );
}