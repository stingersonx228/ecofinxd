/**
 * Панель организации: потребление в разрезе подразделений.
 *
 * Доступна только школам и бизнесу. У домохозяйства подразделений нет —
 * такой профиль отправляется обратно на дашборд.
 */

import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { OrgUnitForm } from "@/components/dashboard/org-unit-form";
import { loadOrgData, type OrgUnitRow } from "@/lib/dashboard";
import { isValidProfileId } from "@/lib/profile";
import { RESOURCE_UNITS } from "@/lib/tariffs";
import {
  hasOrgUnits,
  OBJECT_TYPE_LABELS,
  RESOURCE_LABELS,
  RESOURCE_TYPES,
  type ResourceType,
} from "@/lib/types";

export const dynamic = "force-dynamic";

/** Русское склонение: 1 подразделение, 2 подразделения, 5 подразделений. */
function pluralizeUnits(count: number): string {
  const lastTwo = count % 100;
  const last = count % 10;

  if (lastTwo >= 11 && lastTwo <= 14) {
    return "подразделений";
  }

  if (last === 1) {
    return "подразделение";
  }

  if (last >= 2 && last <= 4) {
    return "подразделения";
  }

  return "подразделений";
}

/** Число для таблицы: «—», если по этому ресурсу подразделение ничего не тратит. */
function cell(row: OrgUnitRow, resourceType: ResourceType): string {
  const value = row.values[resourceType];

  return value === undefined
    ? "—"
    : value.toLocaleString("ru-RU", { maximumFractionDigits: 1 });
}

export default async function OrgPage({
  params,
}: PageProps<"/dashboard/[profileId]/org">) {
  const { profileId } = await params;

  if (!isValidProfileId(profileId)) {
    notFound();
  }

  const data = await loadOrgData(profileId);

  if (!data) {
    notFound();
  }

  const { profile, summary, baselines } = data;

  if (!hasOrgUnits(profile.object_type)) {
    redirect(`/dashboard/${profile.id}`);
  }

  // Показываем только те ресурсы, по которым хоть одно подразделение заведено:
  // три пустых колонки таблицу не украшают.
  const visibleResources = RESOURCE_TYPES.filter((resourceType) =>
    summary.rows.some((row) => row.values[resourceType] !== undefined),
  );

  const worstRow = summary.rows.find(
    (row) => row.name === summary.worstUnitName,
  );

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <header>
        <Link
          href={`/dashboard/${profile.id}`}
          className="text-sm font-medium text-brand-700 hover:text-brand-900"
        >
          ← {profile.name}
        </Link>

        <h1 className="mt-5 text-2xl font-semibold tracking-tight sm:text-3xl">
          Панель организации
        </h1>
        <p className="mt-1 text-sm text-muted">
          {OBJECT_TYPE_LABELS[profile.object_type]} · {profile.region} ·{" "}
          {summary.rows.length} {pluralizeUnits(summary.rows.length)}
        </p>
      </header>

      {worstRow &&
      worstRow.worstResource &&
      worstRow.worstDeviationPercent !== null ? (
        <section className="mt-6 rounded-xl border border-over/30 bg-over/5 px-5 py-4">
          <p className="text-sm font-medium text-over">
            Наибольший перерасход: {worstRow.name}
          </p>
          <p className="mt-1 text-sm text-muted">
            Тратит на {worstRow.worstDeviationPercent}% больше среднего по
            подразделениям —{" "}
            {RESOURCE_LABELS[worstRow.worstResource].toLowerCase()}. С него
            имеет смысл начинать.
          </p>
        </section>
      ) : null}

      <section className="mt-6">
        <h2 className="text-lg font-semibold">Потребление по подразделениям</h2>

        {summary.rows.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-border bg-surface px-6 py-10 text-center">
            <p className="font-medium">Подразделений пока нет</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted">
              Добавьте {profile.object_type === "school"
                ? "корпуса или классы"
                : "отделы или помещения"}{" "}
              ниже — и увидите, где именно уходит больше всего ресурсов.
            </p>
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-surface">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-4 py-3 font-medium">Подразделение</th>
                  {visibleResources.map((resourceType) => (
                    <th
                      key={resourceType}
                      className="px-4 py-3 text-right font-medium"
                    >
                      {RESOURCE_LABELS[resourceType]}
                      <span className="block text-xs font-normal text-muted">
                        {RESOURCE_UNITS[resourceType]}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {summary.rows.map((row) => {
                  const isWorst = row.name === summary.worstUnitName;

                  return (
                    <tr
                      key={row.name}
                      className={`border-b border-border last:border-0 ${
                        isWorst ? "bg-over/5" : ""
                      }`}
                    >
                      <td className="px-4 py-3">
                        <span className={isWorst ? "font-medium" : ""}>
                          {row.name}
                        </span>
                        {isWorst && row.worstDeviationPercent !== null ? (
                          <span className="ml-2 rounded-full bg-over/10 px-2 py-0.5 text-xs text-over">
                            +{row.worstDeviationPercent}% к среднему
                          </span>
                        ) : null}
                      </td>

                      {visibleResources.map((resourceType) => (
                        <td
                          key={resourceType}
                          className="px-4 py-3 text-right tabular-nums"
                        >
                          {cell(row, resourceType)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>

              <tfoot>
                <tr className="border-t border-border bg-brand-50">
                  <td className="px-4 py-3 font-medium">Итого</td>
                  {visibleResources.map((resourceType) => (
                    <td
                      key={resourceType}
                      className="px-4 py-3 text-right font-semibold tabular-nums"
                    >
                      {(summary.totals[resourceType] ?? 0).toLocaleString(
                        "ru-RU",
                        { maximumFractionDigits: 1 },
                      )}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      {summary.rows.length > 0 ? (
        <section className="mt-6">
          <h2 className="text-lg font-semibold">Сходится ли с общим счётом</h2>
          <p className="mt-1 text-xs text-muted">
            Сумма по подразделениям против показателей, введённых для объекта
            целиком. Заметный разрыв означает, что часть потребления ещё не
            расписана.
          </p>

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {visibleResources.map((resourceType) => {
              const total = summary.totals[resourceType] ?? 0;
              const baseline = baselines.find(
                (item) => item.resource_type === resourceType,
              );

              const coverage =
                baseline && baseline.value > 0
                  ? Math.round((total / baseline.value) * 100)
                  : null;

              return (
                <article
                  key={resourceType}
                  className="rounded-xl border border-border bg-surface p-4"
                >
                  <h3 className="text-sm font-medium text-muted">
                    {RESOURCE_LABELS[resourceType]}
                  </h3>

                  <p className="mt-2 text-xl font-semibold tabular-nums">
                    {total.toLocaleString("ru-RU", {
                      maximumFractionDigits: 1,
                    })}
                    <span className="ml-1 text-sm font-normal text-muted">
                      {RESOURCE_UNITS[resourceType]}
                    </span>
                  </p>

                  <p className="mt-1 text-sm text-muted">
                    {baseline
                      ? `По объекту целиком: ${baseline.value} ${baseline.unit}`
                      : "Показатель по объекту не введён"}
                  </p>

                  {coverage !== null ? (
                    <p className="mt-3 text-sm">
                      Расписано{" "}
                      <span className="font-medium">{coverage}%</span>
                    </p>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      <div className="mt-6">
        <OrgUnitForm
          profileId={profile.id}
          objectType={profile.object_type}
        />
      </div>
    </main>
  );
}
