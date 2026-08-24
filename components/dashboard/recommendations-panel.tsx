"use client";

/**
 * Список AI-рекомендаций с кнопками «Применил» / «Не подходит».
 *
 * Состояние не дублируется в компоненте: источник правды — серверные пропсы,
 * а useOptimistic лишь показывает результат нажатия до того, как сервер
 * ответит. После успешного запроса router.refresh() перерисовывает серверную
 * часть страницы, и цифра суммарной экономии в шапке приходит в соответствие
 * со списком. Своя копия списка в useState рассинхронизировалась бы с шапкой.
 */

import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";

import { formatResourceAmount, formatTenge } from "@/lib/tariffs";
import {
  RESOURCE_LABELS,
  type AiRecommendation,
  type RecommendationStatus,
} from "@/lib/types";

interface StatusUpdate {
  id: string;
  status: RecommendationStatus;
}

/** Читаемое сообщение из ответа API; запасной текст, если ответ нераспознаваем. */
async function readError(response: Response, fallback: string): Promise<string> {
  const payload: unknown = await response.json().catch(() => null);

  if (
    payload &&
    typeof payload === "object" &&
    typeof (payload as { error?: unknown }).error === "string"
  ) {
    return (payload as { error: string }).error;
  }

  return fallback;
}

export function RecommendationsPanel({
  profileId,
  recommendations,
}: {
  profileId: string;
  recommendations: AiRecommendation[];
}) {
  const router = useRouter();

  const [optimisticRecommendations, applyStatus] = useOptimistic(
    recommendations,
    (current, update: StatusUpdate) =>
      current.map((item) =>
        item.id === update.id ? { ...item, status: update.status } : item,
      ),
  );

  const [isGenerating, startGenerating] = useTransition();
  const [isUpdating, startUpdating] = useTransition();

  const [generateError, setGenerateError] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);

  const pending = optimisticRecommendations.filter(
    (item) => item.status === "pending",
  );
  const applied = optimisticRecommendations.filter(
    (item) => item.status === "applied",
  );
  const dismissed = optimisticRecommendations.filter(
    (item) => item.status === "dismissed",
  );

  const hasAny = optimisticRecommendations.length > 0;

  function generate() {
    setGenerateError(null);

    startGenerating(async () => {
      try {
        const response = await fetch("/api/recommendations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ profile_id: profileId }),
        });

        if (!response.ok) {
          setGenerateError(
            await readError(
              response,
              "Не удалось сгенерировать рекомендации. Попробуйте ещё раз.",
            ),
          );
          return;
        }

        router.refresh();
      } catch {
        setGenerateError(
          "Не удалось связаться с сервером. Проверьте интернет и попробуйте ещё раз.",
        );
      }
    });
  }

  function updateStatus(id: string, status: RecommendationStatus) {
    setUpdateError(null);

    startUpdating(async () => {
      applyStatus({ id, status });

      try {
        const response = await fetch("/api/recommendations", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, status }),
        });

        if (!response.ok) {
          setUpdateError(
            await readError(
              response,
              "Не удалось обновить статус. Попробуйте ещё раз.",
            ),
          );
          return;
        }

        router.refresh();
      } catch {
        setUpdateError("Не удалось связаться с сервером. Попробуйте ещё раз.");
      }
    });
  }

  const generateLabel = isGenerating
    ? "Анализируем…"
    : hasAny
      ? "Сгенерировать заново"
      : "Сгенерировать рекомендации";

  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Рекомендации</h2>

        <button
          type="button"
          onClick={generate}
          disabled={isGenerating}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {generateLabel}
        </button>
      </div>

      {generateError ? (
        <div
          role="alert"
          className="mt-4 rounded-lg border border-over/30 bg-over/5 px-4 py-3 text-sm text-over"
        >
          {generateError}
          <button
            type="button"
            onClick={generate}
            disabled={isGenerating}
            className="ml-2 font-medium underline underline-offset-2 disabled:opacity-60"
          >
            Повторить
          </button>
        </div>
      ) : null}

      {updateError ? (
        <div
          role="alert"
          className="mt-4 rounded-lg border border-over/30 bg-over/5 px-4 py-3 text-sm text-over"
        >
          {updateError}
        </div>
      ) : null}

      {isGenerating ? (
        <div className="mt-4 space-y-3" aria-hidden>
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              className="h-28 animate-pulse rounded-xl border border-border bg-surface"
            />
          ))}
        </div>
      ) : null}

      {!hasAny && !isGenerating ? (
        <div className="mt-4 rounded-xl border border-dashed border-border bg-surface px-6 py-10 text-center">
          <p className="font-medium">Рекомендаций пока нет</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            Мы сравним ваше потребление с нормой по региону и предложим
            конкретные шаги с расчётом экономии в тенге.
          </p>
          <button
            type="button"
            onClick={generate}
            disabled={isGenerating}
            className="mt-5 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Сгенерировать рекомендации
          </button>
        </div>
      ) : null}

      {pending.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {pending.map((item) => (
            <li
              key={item.id}
              className="rounded-xl border border-border bg-surface p-4 sm:p-5"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700">
                  {RESOURCE_LABELS[item.resource_type]}
                </span>
                <span className="text-sm text-muted">
                  −
                  {formatResourceAmount(
                    Number(item.estimated_savings_resource),
                    item.resource_type,
                  )}
                </span>
                <span className="ml-auto text-base font-semibold text-brand-700">
                  {formatTenge(Number(item.estimated_savings_tenge))}/мес
                </span>
              </div>

              <p className="mt-3">{item.recommendation_text}</p>

              {item.reasoning ? (
                <p className="mt-2 text-sm text-muted">{item.reasoning}</p>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => updateStatus(item.id, "applied")}
                  disabled={isUpdating}
                  className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Применил
                </button>
                <button
                  type="button"
                  onClick={() => updateStatus(item.id, "dismissed")}
                  disabled={isUpdating}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors hover:border-brand-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Не подходит
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {applied.length > 0 ? (
        <>
          <h3 className="mt-8 text-sm font-medium text-muted">
            Применено ({applied.length})
          </h3>
          <ul className="mt-3 space-y-2">
            {applied.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-sm"
              >
                <span className="font-medium text-brand-700">
                  {RESOURCE_LABELS[item.resource_type]}
                </span>
                <span className="min-w-0 flex-1">
                  {item.recommendation_text}
                </span>
                <span className="font-semibold text-brand-700">
                  {formatTenge(Number(item.estimated_savings_tenge))}/мес
                </span>
                <button
                  type="button"
                  onClick={() => updateStatus(item.id, "pending")}
                  disabled={isUpdating}
                  className="text-xs text-muted underline underline-offset-2 disabled:opacity-60"
                >
                  Вернуть
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {dismissed.length > 0 ? (
        <>
          <h3 className="mt-8 text-sm font-medium text-muted">
            Не подошло ({dismissed.length})
          </h3>
          <ul className="mt-3 space-y-2">
            {dismissed.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-border px-4 py-3 text-sm text-muted"
              >
                <span className="font-medium">
                  {RESOURCE_LABELS[item.resource_type]}
                </span>
                <span className="min-w-0 flex-1">
                  {item.recommendation_text}
                </span>
                <button
                  type="button"
                  onClick={() => updateStatus(item.id, "pending")}
                  disabled={isUpdating}
                  className="text-xs underline underline-offset-2 disabled:opacity-60"
                >
                  Вернуть
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}
