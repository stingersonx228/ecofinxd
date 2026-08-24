/**
 * Личный кабинет объекта.
 *
 * Серверный компонент: данные читаются на сервере и приезжают уже в разметке.
 * Интерактивные части вынесены в клиентские островки — график (recharts) и
 * список рекомендаций.
 */

import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ConsumptionChart } from "@/components/dashboard/consumption-chart";
import { RecommendationsPanel } from "@/components/dashboard/recommendations-panel";
import { loadDashboardData, type ResourceComparison } from "@/lib/dashboard";
import { isValidProfileId } from "@/lib/profile";
import { formatTenge } from "@/lib/tariffs";
import {
  OBJECT_TYPE_LABELS,
  RESOURCE_LABELS,
  hasOrgUnits,
} from "@/lib/types";

/**
 * Кэшировать нечего: показатели и рекомендации меняются прямо на этой странице,
 * а router.refresh() после каждого действия должен приносить свежие данные.
 */
export const dynamic = "force-dynamic";

/** Подпись и цвет для отклонения от нормы. */
function deviationBadge(comparison: ResourceComparison) {
  if (comparison.status === "unknown" || comparison.deviationPercent === null) {
    return { text: "Нет данных для сравнения", className: "text-muted" };
  }

  const absolute = Math.abs(comparison.deviationPercent);

  if (comparison.status === "over") {
    return {
      text: `Выше нормы на ${absolute}%`,
      className: "text-over font-medium",
    };
  }

  if (comparison.status === "under") {
    return {
      text: `Ниже нормы на ${absolute}%`,
      className: "text-under font-medium",
    };
  }

  return { text: "На уровне нормы", className: "text-muted" };
}

export default async function DashboardPage({
  params,
}: PageProps<"/dashboard/[profileId]">) {
  const { profileId } = await params;

  // Кривой id до базы не доходит — сразу 404.
  if (!isValidProfileId(profileId)) {
    notFound();
  }

  const data = await loadDashboardData(profileId);

  if (!data) {
    notFound();
  }

  const {
    profile,
    comparisons,
    recommendations,
    appliedSavingsTenge,
    pendingSavingsTenge,
    usesFallbackBenchmark,
  } = data;

  const heroValue =
    appliedSavingsTenge > 0 ? appliedSavingsTenge : pendingSavingsTenge;
  const heroIsApplied = appliedSavingsTenge > 0;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <header>
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-medium text-brand-700 hover:text-brand-900"
        >
          <span aria-hidden>←</span>
          <Image
            src="/logo-mark.png"
            alt=""
            width={512}
            height={512}
            className="h-5 w-5"
          />
          EcoFin
        </Link>

        <div className="mt-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {profile.name}
            </h1>
            <p className="mt-1 text-sm text-muted">
              {OBJECT_TYPE_LABELS[profile.object_type]} · {profile.region}
            </p>
          </div>

          {hasOrgUnits(profile.object_type) ? (
            <Link
              href={`/dashboard/${profile.id}/org`}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors hover:border-brand-300"
            >
              Панель организации
            </Link>
          ) : null}
        </div>
      </header>

      {/* Главный визуальный акцент страницы. */}
      <section className="mt-6 rounded-2xl bg-brand-800 px-6 py-8 text-white sm:px-8 sm:py-10">
        <p className="text-sm text-brand-100">
          {heroIsApplied
            ? "Ваша экономия по применённым рекомендациям"
            : "Ваша потенциальная экономия"}
        </p>

        <p className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">
          {formatTenge(heroValue)}
          <span className="ml-2 text-xl font-normal text-brand-200">/мес</span>
        </p>

        <div className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-sm">
          <p className="text-brand-100">
            Применено:{" "}
            <span className="font-medium text-white">
              {formatTenge(appliedSavingsTenge)}/мес
            </span>
          </p>
          <p className="text-brand-100">
            Ещё доступно:{" "}
            <span className="font-medium text-white">
              {formatTenge(pendingSavingsTenge)}/мес
            </span>
          </p>
          <p className="text-brand-100">
            В год:{" "}
            <span className="font-medium text-white">
              {formatTenge(heroValue * 12)}
            </span>
          </p>
        </div>

        {recommendations.length === 0 ? (
          <p className="mt-4 text-sm text-brand-200">
            Пока считать нечего — сгенерируйте рекомендации ниже.
          </p>
        ) : null}
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Потребление против нормы</h2>

        {usesFallbackBenchmark ? (
          <p className="mt-1 text-xs text-muted">
            По части ресурсов сравнение идёт со среднереспубликанскими
            показателями: отдельных данных по региону «{profile.region}» пока нет.
          </p>
        ) : null}

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {comparisons.map((comparison) => {
            const badge = deviationBadge(comparison);

            return (
              <article
                key={comparison.resourceType}
                className="rounded-xl border border-border bg-surface p-4"
              >
                <h3 className="text-sm font-medium text-muted">
                  {RESOURCE_LABELS[comparison.resourceType]}
                </h3>

                <p className="mt-2 text-2xl font-semibold">
                  {comparison.value === null ? (
                    <span className="text-muted">—</span>
                  ) : (
                    <>
                      {comparison.value}
                      <span className="ml-1 text-sm font-normal text-muted">
                        {comparison.unit}
                      </span>
                    </>
                  )}
                </p>

                <p className="mt-1 text-sm text-muted">
                  {comparison.benchmark === null
                    ? "Норма неизвестна"
                    : `Норма: ${comparison.benchmark} ${comparison.unit}`}
                </p>

                <p className={`mt-3 text-sm ${badge.className}`}>{badge.text}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="mt-8 rounded-xl border border-border bg-surface p-4 sm:p-6">
        <h2 className="text-lg font-semibold">Сравнение с нормой, % </h2>
        <p className="mt-1 text-xs text-muted">
          Норма по региону принята за 100%.
        </p>

        <div className="mt-4">
          <ConsumptionChart comparisons={comparisons} />
        </div>
      </section>

      <RecommendationsPanel
        profileId={profile.id}
        recommendations={recommendations}
      />
    </main>
  );
}
