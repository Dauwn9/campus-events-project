import Link from "next/link";
import LoginForm from "@/components/features/auth/LoginForm";

export default function LoginPage() {
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Вход</h1>

      <LoginForm />

      <div className="rounded-control bg-primary/5 p-3 text-xs text-muted">
        <p className="mb-1 font-medium text-text">Тестовые аккаунты:</p>
        <p>student / student123</p>
        <p>organizer / organizer123</p>
        <p>admin / admin123</p>
      </div>

      <div className="flex justify-between text-sm">
        <Link href="/register" className="text-primary hover:underline">
          Регистрация
        </Link>
        <Link href="/" className="text-muted hover:text-primary">
          На афишу
        </Link>
      </div>
    </div>
  );
}