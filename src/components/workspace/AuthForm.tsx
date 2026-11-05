import Link from "next/link";
import ActionForm from "./ActionForm";
import { loginAction, registerAccountAction } from "@/app/campus-actions";
import Icon from "@/components/ui/Icon";
export default function AuthForm({ register = false }: { register?: boolean }) {
  return (
    <div className="auth-card">
      <Link href="/" className="auth-back">
        ← Вернуться к афише
      </Link>
      <span className="section-kicker">ASTANA INTERNATIONAL UNIVERSITY</span>
      <h1>
        {register ? "Стань частью кампуса" : "Рады видеть снова"}
        <span>.</span>
      </h1>
      <p>
        {register
          ? "Создайте студенческий аккаунт, чтобы записываться на события и получать QR-билеты."
          : "Войдите, чтобы продолжить свою историю в AIU."}
      </p>
      <ActionForm action={register ? registerAccountAction : loginAction}>
        {register && (
          <label>
            Имя и фамилия
            <input
              name="name"
              required
              minLength={2}
              maxLength={80}
              autoComplete="name"
              placeholder="Как к вам обращаться?"
            />
          </label>
        )}
        <label>
          Email
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            maxLength={150}
            placeholder="name@example.com"
          />
        </label>
        <label>
          Пароль
          <input
            name="password"
            type="password"
            required
            minLength={register ? 8 : 1}
            maxLength={128}
            autoComplete={register ? "new-password" : "current-password"}
          />
        </label>
        {register && (
          <label>
            Повторите пароль
            <input
              name="confirmPassword"
              type="password"
              required
              minLength={8}
              maxLength={128}
              autoComplete="new-password"
            />
          </label>
        )}
        <button className="workspace-button">
          {register ? "Создать аккаунт" : "Войти"}
          <Icon name="right" size={17} />
        </button>
      </ActionForm>
      <p className="auth-switch">
        {register ? "Уже есть аккаунт?" : "Ещё нет аккаунта?"}{" "}
        <Link href={register ? "/login" : "/register"}>
          {register ? "Войти" : "Зарегистрироваться"}
        </Link>
      </p>
      <details className="demo-credentials">
        <summary>Демонстрационные аккаунты</summary>
        <p>Локальное демо. Используйте тестовые данные.</p>
        <dl>
          <dt>Студент</dt>
          <dd>student@demo.aiu.kz</dd>
          <dt>Организатор</dt>
          <dd>organizer2@demo.aiu.kz</dd>
          <dt>Администратор</dt>
          <dd>admin@demo.aiu.kz</dd>
          <dt>Общий пароль</dt>
          <dd>Campus2026!</dd>
        </dl>
      </details>
    </div>
  );
}
