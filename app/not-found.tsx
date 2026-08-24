import Link from "next/link";

/**
 * Глобальная страница 404.
 *
 * Сюда попадают и несуществующие адреса, и кабинеты с неизвестным id: проверка
 * профиля живёт в layout сегмента дашборда, а notFound() из layout всплывает к
 * родительской границе — то есть сюда.
 */
export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <p className="text-sm font-medium text-muted">Ошибка 404</p>

      <h1 className="mt-2 text-2xl font-semibold tracking-tight">
        Кабинет не найден
      </h1>

      <p className="mt-3 text-muted">
        Такой страницы не существует. Возможно, ссылка устарела, кабинет удалён
        или в адресе опечатка.
      </p>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          href="/onboarding"
          className="rounded-lg bg-brand-600 px-5 py-2.5 font-medium text-white transition-colors hover:bg-brand-700"
        >
          Создать кабинет
        </Link>
        <Link
          href="/"
          className="rounded-lg border border-border px-5 py-2.5 font-medium transition-colors hover:border-brand-300"
        >
          На главную
        </Link>
      </div>
    </main>
  );
}
