"use client";

import Link from "next/link";

/**
 * Загрузка кабинета упала — например, недоступна база. Показываем понятный
 * экран с кнопкой повтора вместо технической страницы Next.
 *
 * reset() переигрывает рендер сегмента: при разовом сбое сети этого достаточно,
 * перезагружать всю страницу не нужно.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">
        Не удалось загрузить кабинет
      </h1>

      <p className="mt-3 text-muted">
        {error.message || "Произошла непредвиденная ошибка."}
      </p>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-lg bg-brand-600 px-5 py-2.5 font-medium text-white transition-colors hover:bg-brand-700"
        >
          Попробовать ещё раз
        </button>
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
