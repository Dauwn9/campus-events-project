export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="auth-layout" id="main-content">
      <aside className="auth-story">
        <a href="/" className="auth-logo">
          AIU <span>campus events</span>
        </a>
        <div>
          <span className="section-kicker">БОЛЬШЕ, ЧЕМ УЧЁБА</span>
          <h2>
            Твои люди.
            <br />
            Твои идеи.
            <br />
            <em>Твоя история.</em>
          </h2>
          <p>
            Начни с одного события.
            <br />
            Найди то, что останется с тобой.
          </p>
        </div>
        <span className="auth-story-bottom">
          ASTANA INTERNATIONAL UNIVERSITY · 2026 / 27
        </span>
      </aside>
      {children}
    </main>
  );
}
