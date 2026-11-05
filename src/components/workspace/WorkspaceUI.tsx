import Link from "next/link";
import type { ReactNode } from "react";
import Icon from "@/components/ui/Icon";
import { statusLabels } from "@/lib/status";
export function PageHeading({
  eyebrow,
  title,
  text,
  action,
}: {
  eyebrow: string;
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="workspace-heading">
      <div>
        <span className="section-kicker">{eyebrow}</span>
        <h1>
          {title}
          <span>.</span>
        </h1>
        <p>{text}</p>
      </div>
      {action}
    </div>
  );
}
export function Stats({
  items,
}: {
  items: { label: string; value: string | number; note?: string }[];
}) {
  return (
    <div className="workspace-stats">
      {items.map((item) => (
        <div key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          {item.note && <small>{item.note}</small>}
        </div>
      ))}
    </div>
  );
}
export function Status({ value }: { value: string }) {
  return (
    <span className={`status-tag status-${value.toLowerCase()}`}>
      {statusLabels[value] ?? value}
    </span>
  );
}
export function Panel({
  title,
  children,
  aside,
}: {
  title: string;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <section className="workspace-panel">
      <div className="panel-heading">
        <h2>{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}
export function Empty({
  title,
  text,
  href,
  label,
}: {
  title: string;
  text: string;
  href?: string;
  label?: string;
}) {
  return (
    <div className="workspace-empty">
      <Icon name="calendar" size={30} />
      <h2>{title}</h2>
      <p>{text}</p>
      {href && (
        <Link className="workspace-button" href={href}>
          {label ?? "Перейти к афише"}
          <Icon name="right" size={16} />
        </Link>
      )}
    </div>
  );
}
export function DemoNotice() {
  return (
    <div className="workspace-demo">
      <span className="live-dot" />
      <span>Локальное демо · Изменения сохраняются на этом компьютере</span>
      <Link href="/">
        Вернуться к афише <Icon name="arrow" size={13} />
      </Link>
    </div>
  );
}
