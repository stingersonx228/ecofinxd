/**
 * Данные личного кабинета. Дашборд — серверный компонент и ходит в Supabase
 * напрямую: HTTP-запрос внутрь самого себя добавил бы задержку и точку отказа.
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  FALLBACK_REGION,
  RESOURCE_TYPES,
  type AiRecommendation,
  type OrgUnit,
  type Profile,
  type RegionalBenchmark,
  type ResourceBaseline,
  type ResourceType,
} from "@/lib/types";

/** Как потребление объекта соотносится с нормой по региону. */
export interface ResourceComparison {
  resourceType: ResourceType;
  /** Потребление объекта; null — показатель не вводили. */
  value: number | null;
  unit: string;
  /** Средний показатель по региону; null — бенчмарка нет. */
  benchmark: number | null;
  /** Регион, из которого взят бенчмарк: может быть общестрановым. */
  benchmarkRegion: string | null;
  /** Отклонение в процентах: положительное — перерасход. */
  deviationPercent: number | null;
  status: "over" | "under" | "equal" | "unknown";
}

export interface DashboardData {
  profile: Profile;
  baselines: ResourceBaseline[];
  comparisons: ResourceComparison[];
  recommendations: AiRecommendation[];
  /** Экономия по рекомендациям, которые пользователь отметил применёнными. */
  appliedSavingsTenge: number;
  /** Экономия, которую ещё можно получить: рекомендации в статусе pending. */
  pendingSavingsTenge: number;
  /** Использован ли хоть один общестрановой бенчмарк вместо регионального. */
  usesFallbackBenchmark: boolean;
}

function roundToTenth(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Ресурсы без введённых данных попадают в результат со status "unknown": на
 * дашборде честнее показать «нет данных», чем молча пропустить строку.
 */
function buildComparisons(
  baselines: ResourceBaseline[],
  benchmarks: RegionalBenchmark[],
): ResourceComparison[] {
  return RESOURCE_TYPES.map((resourceType) => {
    const baseline = baselines.find(
      (item) => item.resource_type === resourceType,
    );
    const benchmark = benchmarks.find(
      (item) => item.resource_type === resourceType,
    );

    const value = baseline ? baseline.value : null;
    const hasBenchmark = benchmark !== undefined && benchmark.avg_value > 0;

    if (value === null || !hasBenchmark) {
      return {
        resourceType,
        value,
        unit: baseline?.unit ?? benchmark?.unit ?? "",
        benchmark: hasBenchmark ? benchmark.avg_value : null,
        benchmarkRegion: benchmark?.region ?? null,
        deviationPercent: null,
        status: "unknown" as const,
      };
    }

    const benchmarkValue = benchmark.avg_value;
    const deviation = ((value - benchmarkValue) / benchmarkValue) * 100;
    const rounded = roundToTenth(deviation);

    return {
      resourceType,
      value,
      unit: baseline?.unit ?? benchmark.unit,
      benchmark: benchmarkValue,
      benchmarkRegion: benchmark.region,
      deviationPercent: rounded,
      // Отклонение в пределах процента считаем попаданием в норму: точность
      // исходных данных всё равно не позволяет говорить о десятых долях.
      status: rounded > 1 ? "over" : rounded < -1 ? "under" : "equal",
    };
  });
}

/** @returns null, если профиля с таким id нет. */
export async function loadDashboardData(
  profileId: string,
): Promise<DashboardData | null> {
  const supabase = createSupabaseServerClient();

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", profileId)
    .maybeSingle<Profile>();

  if (profileError) {
    console.error("[dashboard] Профиль не прочитался:", profileError);
    throw new Error("Не удалось загрузить профиль");
  }

  if (!profile) {
    return null;
  }

  const [baselinesResult, benchmarksResult, recommendationsResult] =
    await Promise.all([
      supabase
        .from("resource_baselines")
        .select("*")
        .eq("profile_id", profile.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("regional_benchmarks")
        .select("*")
        .eq("object_type", profile.object_type)
        .in("region", [profile.region, FALLBACK_REGION]),
      supabase
        .from("ai_recommendations")
        .select("*")
        .eq("profile_id", profile.id)
        .order("generated_at", { ascending: false }),
    ]);

  if (baselinesResult.error) {
    console.error("[dashboard] Baselines не прочитались:", baselinesResult.error);
    throw new Error("Не удалось загрузить данные о потреблении");
  }

  if (recommendationsResult.error) {
    console.error(
      "[dashboard] Рекомендации не прочитались:",
      recommendationsResult.error,
    );
    throw new Error("Не удалось загрузить рекомендации");
  }

  if (benchmarksResult.error) {
    // Не критично: дашборд отрисуется без сравнения с нормой.
    console.warn(
      "[dashboard] Бенчмарки не прочитались:",
      benchmarksResult.error,
    );
  }

  const baselines = (baselinesResult.data as ResourceBaseline[] | null) ?? [];
  const recommendations =
    (recommendationsResult.data as AiRecommendation[] | null) ?? [];

  // Значение по региону профиля вытесняет общестрановое.
  const benchmarkRows =
    (benchmarksResult.data as RegionalBenchmark[] | null) ?? [];
  const byResource = new Map<string, RegionalBenchmark>();

  for (const row of benchmarkRows) {
    const existing = byResource.get(row.resource_type);

    if (!existing || row.region === profile.region) {
      byResource.set(row.resource_type, row);
    }
  }

  const comparisons = buildComparisons(baselines, [...byResource.values()]);

  const sumBy = (status: AiRecommendation["status"]) =>
    recommendations
      .filter((item) => item.status === status)
      .reduce((total, item) => total + Number(item.estimated_savings_tenge), 0);

  return {
    profile,
    baselines,
    comparisons,
    recommendations,
    appliedSavingsTenge: sumBy("applied"),
    pendingSavingsTenge: sumBy("pending"),
    usesFallbackBenchmark: comparisons.some(
      (item) => item.benchmarkRegion === FALLBACK_REGION,
    ),
  };
}

// ---------------------------------------------------------------------------
// Панель организации
// ---------------------------------------------------------------------------

/** Одно подразделение и его потребление по ресурсам. */
export interface OrgUnitRow {
  name: string;
  values: Partial<Record<ResourceType, number>>;
  /** Насколько сильнее среднего по подразделениям тратит, в процентах. */
  worstDeviationPercent: number | null;
  /** Ресурс, по которому это превышение зафиксировано. */
  worstResource: ResourceType | null;
}

export interface OrgSummary {
  rows: OrgUnitRow[];
  /** Суммарное потребление по организации. */
  totals: Partial<Record<ResourceType, number>>;
  /** Среднее по подразделениям — база для поиска перерасхода. */
  averages: Partial<Record<ResourceType, number>>;
  /** Подразделение с самым большим превышением среднего; null — не с чем сравнивать. */
  worstUnitName: string | null;
}

export interface OrgData {
  profile: Profile;
  units: OrgUnit[];
  summary: OrgSummary;
  /** Показатели самого объекта — чтобы видеть, какая доля учтена по подразделениям. */
  baselines: ResourceBaseline[];
}

/**
 * Норматива на отдельное подразделение не существует, поэтому «перерасход»
 * считается относительно среднего по остальным подразделениям этой же
 * организации. Имеет смысл только при двух и более подразделениях.
 */
export function buildOrgSummary(units: OrgUnit[]): OrgSummary {
  const byName = new Map<string, Partial<Record<ResourceType, number>>>();

  for (const unit of units) {
    const existing = byName.get(unit.unit_name) ?? {};
    // Несколько строк по одному ресурсу складываем: пользователь мог добавить
    // подразделение дважды, терять данные из-за этого нельзя.
    existing[unit.resource_type] =
      (existing[unit.resource_type] ?? 0) + Number(unit.baseline_value);
    byName.set(unit.unit_name, existing);
  }

  const totals: Partial<Record<ResourceType, number>> = {};
  const counts: Partial<Record<ResourceType, number>> = {};

  for (const values of byName.values()) {
    for (const resourceType of RESOURCE_TYPES) {
      const value = values[resourceType];

      if (value === undefined) {
        continue;
      }

      totals[resourceType] = (totals[resourceType] ?? 0) + value;
      counts[resourceType] = (counts[resourceType] ?? 0) + 1;
    }
  }

  const averages: Partial<Record<ResourceType, number>> = {};

  for (const resourceType of RESOURCE_TYPES) {
    const count = counts[resourceType] ?? 0;
    const total = totals[resourceType];

    // При одном подразделении среднее равно ему самому: сравнивать не с чем.
    if (count > 1 && total !== undefined) {
      averages[resourceType] = total / count;
    }
  }

  const rows: OrgUnitRow[] = [...byName.entries()]
    .map(([name, values]) => {
      let worstDeviationPercent: number | null = null;
      let worstResource: ResourceType | null = null;

      for (const resourceType of RESOURCE_TYPES) {
        const value = values[resourceType];
        const average = averages[resourceType];

        if (value === undefined || average === undefined || average <= 0) {
          continue;
        }

        const deviation = ((value - average) / average) * 100;

        if (deviation > 0 && (worstDeviationPercent === null || deviation > worstDeviationPercent)) {
          worstDeviationPercent = Math.round(deviation * 10) / 10;
          worstResource = resourceType;
        }
      }

      return { name, values, worstDeviationPercent, worstResource };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "ru"));

  const worst = rows.reduce<OrgUnitRow | null>((current, row) => {
    if (row.worstDeviationPercent === null) {
      return current;
    }

    if (
      current === null ||
      current.worstDeviationPercent === null ||
      row.worstDeviationPercent > current.worstDeviationPercent
    ) {
      return row;
    }

    return current;
  }, null);

  return {
    rows,
    totals,
    averages,
    worstUnitName: worst?.name ?? null,
  };
}

/** @returns null, если профиля нет. */
export async function loadOrgData(profileId: string): Promise<OrgData | null> {
  const supabase = createSupabaseServerClient();

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", profileId)
    .maybeSingle<Profile>();

  if (profileError) {
    console.error("[dashboard/org] Профиль не прочитался:", profileError);
    throw new Error("Не удалось загрузить профиль");
  }

  if (!profile) {
    return null;
  }

  const [unitsResult, baselinesResult] = await Promise.all([
    supabase
      .from("org_units")
      .select("*")
      .eq("profile_id", profile.id)
      .order("unit_name", { ascending: true }),
    supabase
      .from("resource_baselines")
      .select("*")
      .eq("profile_id", profile.id),
  ]);

  if (unitsResult.error) {
    console.error(
      "[dashboard/org] Подразделения не прочитались:",
      unitsResult.error,
    );
    throw new Error("Не удалось загрузить подразделения");
  }

  if (baselinesResult.error) {
    console.warn(
      "[dashboard/org] Baselines не прочитались:",
      baselinesResult.error,
    );
  }

  const units = (unitsResult.data as OrgUnit[] | null) ?? [];

  return {
    profile,
    units,
    summary: buildOrgSummary(units),
    baselines: (baselinesResult.data as ResourceBaseline[] | null) ?? [],
  };
}
