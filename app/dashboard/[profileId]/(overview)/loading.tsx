/**
 * Скелетон дашборда. Next показывает его, пока серверный компонент ждёт данные
 * из Supabase, — вместо пустого экрана и прыжка вёрстки при появлении контента.
 * Блоки повторяют реальную сетку страницы.
 */
export default function DashboardLoading() {
  return (
    <main
      className="mx-auto w-full max-w-5xl animate-pulse px-4 py-8 sm:px-6 sm:py-12"
      aria-busy
      aria-label="Загружаем кабинет"
    >
      <div className="h-4 w-24 rounded bg-brand-100" />

      <div className="mt-5 space-y-2">
        <div className="h-8 w-64 rounded bg-brand-100" />
        <div className="h-4 w-40 rounded bg-brand-100" />
      </div>

      <div className="mt-6 h-44 rounded-2xl bg-brand-100" />

      <div className="mt-8 h-5 w-56 rounded bg-brand-100" />
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((index) => (
          <div
            key={index}
            className="h-36 rounded-xl border border-border bg-surface"
          />
        ))}
      </div>

      <div className="mt-8 h-80 rounded-xl border border-border bg-surface" />

      <div className="mt-10 h-5 w-40 rounded bg-brand-100" />
      <div className="mt-4 space-y-3">
        {[0, 1, 2].map((index) => (
          <div
            key={index}
            className="h-28 rounded-xl border border-border bg-surface"
          />
        ))}
      </div>
    </main>
  );
}
