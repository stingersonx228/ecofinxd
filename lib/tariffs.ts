/**
 * Тарифы и перевод сэкономленного ресурса в тенге.
 *
 * ЭТО ЕДИНСТВЕННОЕ МЕСТО, ГДЕ СЧИТАЮТСЯ ДЕНЬГИ. Модель оценивает экономию
 * только в натуральном выражении: она ошибается в арифметике и не знает
 * тарифов, а сумма экономии — главный экран продукта.
 *
 * ИСТОЧНИК: значения ПРИМЕРНЫЕ, порядок величины по Казахстану, не выверены по
 * конкретному поставщику. Перед боевым использованием заменить на действующие
 * тарифы региона. Те же значения продублированы в supabase/schema.sql
 * (regional_benchmarks.tariff_per_unit) — менять оба места.
 */

import type { ResourceType } from "./types";

/** Тенге за единицу ресурса: кВт·ч, м³, кг. */
export const TARIFFS_TENGE: Record<ResourceType, number> = {
  electricity: 25,
  water: 180,
  waste: 12,
};

export const RESOURCE_UNITS: Record<ResourceType, string> = {
  electricity: "кВт·ч/мес",
  water: "м³/мес",
  waste: "кг/мес",
};

/** Единица без периода — для подписи тарифа: «25 тг/кВт·ч». */
export const TARIFF_UNITS: Record<ResourceType, string> = {
  electricity: "кВт·ч",
  water: "м³",
  waste: "кг",
};

/**
 * Переводит сэкономленный объём ресурса в тенге за месяц.
 *
 * NaN, Infinity, отрицательные значения и неизвестный ресурс дают 0, а не NaN
 * в интерфейсе.
 */
export function calculateSavingsTenge(
  resourceType: ResourceType,
  savedAmount: number,
): number {
  const tariff = TARIFFS_TENGE[resourceType];

  if (typeof tariff !== "number") {
    return 0;
  }

  if (typeof savedAmount !== "number" || !Number.isFinite(savedAmount)) {
    return 0;
  }

  if (savedAmount <= 0) {
    return 0;
  }

  return Math.round(savedAmount * tariff);
}

/** `12 480 тг`. Пробел перед «тг» неразрывный, чтобы единица не отрывалась. */
export function formatTenge(amount: number): string {
  const safe =
    typeof amount === "number" && Number.isFinite(amount)
      ? Math.round(amount)
      : 0;

  return `${safe.toLocaleString("ru-RU")} тг`;
}

/** `1 250 кВт·ч/мес`. */
export function formatResourceAmount(
  amount: number,
  resourceType: ResourceType,
): string {
  const safe =
    typeof amount === "number" && Number.isFinite(amount) ? amount : 0;

  const rounded = Math.round(safe * 10) / 10;
  const formatted = rounded.toLocaleString("ru-RU", {
    maximumFractionDigits: 1,
  });

  return `${formatted} ${RESOURCE_UNITS[resourceType] ?? ""}`.trim();
}

/** `25 тг/кВт·ч`. */
export function formatTariff(resourceType: ResourceType): string {
  const tariff = TARIFFS_TENGE[resourceType];
  const unit = TARIFF_UNITS[resourceType];

  if (typeof tariff !== "number" || !unit) {
    return "";
  }

  return `${tariff.toLocaleString("ru-RU")} тг/${unit}`;
}
