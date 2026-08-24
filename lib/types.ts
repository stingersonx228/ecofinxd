/**
 * Типы, зеркалящие supabase/schema.sql. Источник правды — схема: рассинхрон
 * вылезет только в рантайме, потому что PostgREST отдаёт то, что в таблице.
 *
 * numeric-колонки приходят JSON-числами, поэтому им соответствует `number`.
 */

/** Значения union-типов должны совпадать с CHECK-констрейнтами схемы. */
export const OBJECT_TYPES = ["household", "school", "business"] as const;
export type ObjectType = (typeof OBJECT_TYPES)[number];

export const RESOURCE_TYPES = ["electricity", "water", "waste"] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number];

export const RECOMMENDATION_STATUSES = [
  "pending",
  "applied",
  "dismissed",
] as const;
export type RecommendationStatus = (typeof RECOMMENDATION_STATUSES)[number];

/** Регион-заглушка: используется, когда под регион профиля бенчмарков нет. */
export const FALLBACK_REGION = "__default__";

export interface Profile {
  id: string;
  object_type: ObjectType;
  name: string;
  region: string;
  created_at: string;
}

export interface RegionalBenchmark {
  id: string;
  region: string;
  object_type: ObjectType;
  resource_type: ResourceType;
  avg_value: number;
  unit: string;
  tariff_per_unit: number;
  source: string | null;
  created_at: string;
}

export interface ResourceBaseline {
  id: string;
  profile_id: string;
  resource_type: ResourceType;
  value: number;
  unit: string;
  created_at: string;
}

export interface ConsumptionLog {
  id: string;
  profile_id: string;
  resource_type: ResourceType;
  value: number;
  unit: string;
  /** Первый день месяца, к которому относится показание: `YYYY-MM-DD`. */
  period: string;
  created_at: string;
}

export interface AiRecommendation {
  id: string;
  profile_id: string;
  resource_type: ResourceType;
  recommendation_text: string;
  estimated_savings_resource: number;
  resource_unit: string;
  /** Считается на нашей стороне через lib/tariffs.ts, не моделью. */
  estimated_savings_tenge: number;
  reasoning: string | null;
  status: RecommendationStatus;
  generated_at: string;
}

export interface OrgUnit {
  id: string;
  profile_id: string;
  unit_name: string;
  resource_type: ResourceType;
  baseline_value: number;
  unit: string;
  created_at: string;
}

/** Ответ `GET /api/profiles?id=`. */
export interface ProfileWithBaselines extends Profile {
  baselines: ResourceBaseline[];
}

/** Единый формат ошибки во всех route handlers. */
export interface ApiError {
  error: string;
}

// Type guards для валидации входа в route handlers.

export function isObjectType(value: unknown): value is ObjectType {
  return (
    typeof value === "string" &&
    (OBJECT_TYPES as readonly string[]).includes(value)
  );
}

export function isResourceType(value: unknown): value is ResourceType {
  return (
    typeof value === "string" &&
    (RESOURCE_TYPES as readonly string[]).includes(value)
  );
}

export function isRecommendationStatus(
  value: unknown,
): value is RecommendationStatus {
  return (
    typeof value === "string" &&
    (RECOMMENDATION_STATUSES as readonly string[]).includes(value)
  );
}

/** У организаций есть подразделения, у домохозяйства — нет. */
export function hasOrgUnits(objectType: ObjectType): boolean {
  return objectType === "school" || objectType === "business";
}

export const OBJECT_TYPE_LABELS: Record<ObjectType, string> = {
  household: "Дом",
  school: "Школа",
  business: "Бизнес",
};

export const RESOURCE_LABELS: Record<ResourceType, string> = {
  electricity: "Электричество",
  water: "Вода",
  waste: "Отходы",
};

/** Как называется подразделение у разного типа организаций. */
export const ORG_UNIT_LABELS: Record<ObjectType, string> = {
  household: "Помещение",
  school: "Класс или корпус",
  business: "Отдел",
};
