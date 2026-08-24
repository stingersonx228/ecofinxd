"use client";

/**
 * Сравнение потребления с региональной нормой.
 *
 * Столбцы показывают процент от нормы, а не абсолютные значения. Причина
 * простая: у ресурсов несопоставимые единицы — 6200 кВт·ч и 148 м³ на одной оси
 * превращают воду в невидимую полоску у нулевой отметки. В процентах норма
 * всегда 100%, и перерасход читается с одного взгляда. Абсолютные цифры при
 * этом никуда не деваются — они в карточках выше и во всплывающей подсказке.
 */

import {
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TooltipContentProps } from "recharts/types/component/Tooltip";

import type { ResourceComparison } from "@/lib/dashboard";
import { RESOURCE_LABELS } from "@/lib/types";

interface ChartRow {
  name: string;
  /** Потребление объекта в процентах от нормы. */
  Вы: number;
  /** Норма, всегда 100. */
  Норма: number;
  absoluteValue: number;
  absoluteBenchmark: number;
  unit: string;
  isOver: boolean;
}

function buildRows(comparisons: ResourceComparison[]): ChartRow[] {
  return comparisons
    .filter(
      (item): item is ResourceComparison & { value: number; benchmark: number } =>
        item.value !== null && item.benchmark !== null && item.benchmark > 0,
    )
    .map((item) => ({
      name: RESOURCE_LABELS[item.resourceType],
      Вы: Math.round((item.value / item.benchmark) * 100),
      Норма: 100,
      absoluteValue: item.value,
      absoluteBenchmark: item.benchmark,
      unit: item.unit,
      isOver: item.value > item.benchmark,
    }));
}

function ChartTooltip({
  active,
  payload,
}: Partial<TooltipContentProps<number, string>>) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const row = payload[0]?.payload as ChartRow | undefined;

  if (!row) {
    return null;
  }

  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 text-sm shadow-sm">
      <p className="font-medium">{row.name}</p>
      <p className="mt-1 text-muted">
        Вы: {row.absoluteValue} {row.unit} ({row.Вы}% от нормы)
      </p>
      <p className="text-muted">
        Норма: {row.absoluteBenchmark} {row.unit}
      </p>
    </div>
  );
}

export function ConsumptionChart({
  comparisons,
}: {
  comparisons: ResourceComparison[];
}) {
  const rows = buildRows(comparisons);

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted">
        Сравнить не с чем: нет ни введённых показателей, ни данных по региону.
      </p>
    );
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="name"
            tick={{ fill: "var(--muted)", fontSize: 12 }}
            stroke="var(--border)"
          />
          <YAxis
            tick={{ fill: "var(--muted)", fontSize: 12 }}
            stroke="var(--border)"
            tickFormatter={(value: number) => `${value}%`}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--brand-50)" }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="Норма" fill="var(--brand-200)" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Вы" radius={[4, 4, 0, 0]}>
            {rows.map((row) => (
              <Cell
                key={row.name}
                fill={row.isOver ? "var(--over)" : "var(--brand-600)"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
