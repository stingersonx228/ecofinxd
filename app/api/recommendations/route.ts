/**
 * /api/recommendations — генерация, чтение и разметка AI-рекомендаций.
 *
 * POST  { profile_id }      — сгенерировать и сохранить рекомендации.
 * GET   ?profile_id=<uuid>  — уже сохранённые, свежие сверху.
 * PATCH { id, status }      — пометить applied / dismissed.
 */

import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  generateRecommendations,
  type GenerationFailureReason,
} from "@/lib/ai/recommendations";
import { isValidProfileId } from "@/lib/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  FALLBACK_REGION,
  isRecommendationStatus,
  type AiRecommendation,
  type Profile,
  type RegionalBenchmark,
  type ResourceBaseline,
} from "@/lib/types";

/**
 * Запрос к модели идёт десятки секунд. Дефолтный лимит серверлесс-функции
 * короче, и генерация обрывалась бы на середине.
 */
export const maxDuration = 60;

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function notFound(message: string) {
  return NextResponse.json({ error: message }, { status: 404 });
}

function serverError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

/** Текст и код ответа под каждую причину сбоя генерации. */
function failureResponse(reason: GenerationFailureReason) {
  switch (reason) {
    case "not_configured":
      return serverError(
        "AI-сервис не настроен: отсутствует или отклонён ключ Anthropic.",
        503,
      );
    case "no_credit":
      return serverError(
        "Исчерпан баланс AI-сервиса. Пополните счёт Anthropic, чтобы генерировать рекомендации.",
        503,
      );
    case "timeout":
      return serverError(
        "Генерация заняла слишком много времени. Попробуйте ещё раз.",
        504,
      );
    case "rate_limited":
      return serverError(
        "Слишком много запросов к AI-сервису. Подождите минуту и попробуйте снова.",
        429,
      );
    case "empty_result":
      return serverError(
        "Не удалось получить осмысленные рекомендации. Попробуйте ещё раз.",
        502,
      );
    case "api_error":
    default:
      return serverError(
        "AI-сервис временно недоступен. Попробуйте ещё раз через минуту.",
        502,
      );
  }
}

/** Общая для всех методов подготовка клиента БД. */
function getClient():
  | { ok: true; supabase: SupabaseClient }
  | { ok: false; response: NextResponse } {
  try {
    return { ok: true, supabase: createSupabaseServerClient() };
  } catch (error) {
    console.error("[api/recommendations] Supabase не сконфигурирован:", error);
    return {
      ok: false,
      response: serverError(
        "Сервис временно недоступен: не настроено подключение к базе данных.",
      ),
    };
  }
}

/**
 * Подбирает бенчмарки под профиль.
 *
 * Сначала берём значения по региону профиля, недостающие ресурсы добираем из
 * псевдорегиона FALLBACK_REGION со среднереспубликанскими цифрами. Иначе объект
 * из региона без своих данных остался бы вообще без базы для сравнения, и
 * рекомендации выродились бы в общие советы.
 */
async function loadBenchmarks(
  supabase: SupabaseClient,
  profile: Profile,
): Promise<RegionalBenchmark[]> {
  const { data, error } = await supabase
    .from("regional_benchmarks")
    .select("*")
    .eq("object_type", profile.object_type)
    .in("region", [profile.region, FALLBACK_REGION]);

  if (error) {
    console.error(
      "[api/recommendations] Не удалось прочитать бенчмарки:",
      error,
    );
    return [];
  }

  const rows = (data as RegionalBenchmark[] | null) ?? [];
  const byResource = new Map<string, RegionalBenchmark>();

  for (const row of rows) {
    const existing = byResource.get(row.resource_type);

    // Значение по региону профиля вытесняет общестрановое.
    if (!existing || row.region === profile.region) {
      byResource.set(row.resource_type, row);
    }
  }

  return [...byResource.values()];
}

/**
 * POST /api/recommendations
 * Тело: { profile_id }
 */
export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return badRequest("Тело запроса должно быть корректным JSON.");
  }

  if (typeof body !== "object" || body === null) {
    return badRequest("Тело запроса должно быть объектом.");
  }

  const profileId = (body as Record<string, unknown>).profile_id;

  if (!isValidProfileId(profileId)) {
    return badRequest("Поле profile_id должно быть корректным uuid.");
  }

  const client = getClient();

  if (!client.ok) {
    return client.response;
  }

  const { supabase } = client;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", profileId)
    .maybeSingle<Profile>();

  if (profileError) {
    console.error("[api/recommendations] Профиль не прочитался:", profileError);
    return serverError("Не удалось загрузить профиль. Попробуйте ещё раз.");
  }

  if (!profile) {
    return notFound("Профиль не найден.");
  }

  const { data: baselinesData, error: baselinesError } = await supabase
    .from("resource_baselines")
    .select("*")
    .eq("profile_id", profile.id)
    .order("created_at", { ascending: true });

  if (baselinesError) {
    console.error(
      "[api/recommendations] Baselines не прочитались:",
      baselinesError,
    );
    return serverError(
      "Не удалось загрузить данные о потреблении. Попробуйте ещё раз.",
    );
  }

  const baselines = (baselinesData as ResourceBaseline[] | null) ?? [];

  if (baselines.length === 0) {
    return badRequest(
      "У профиля нет данных о потреблении — анализировать нечего. Заполните показатели в онбординге.",
    );
  }

  const benchmarks = await loadBenchmarks(supabase, profile);

  const result = await generateRecommendations(profile, baselines, benchmarks);

  if (!result.ok) {
    return failureResponse(result.reason);
  }

  // Прошлые несмотренные рекомендации убираем, чтобы список не удваивался при
  // повторной генерации. Применённые и отклонённые остаются: это решения
  // пользователя, стирать их нельзя.
  const { error: cleanupError } = await supabase
    .from("ai_recommendations")
    .delete()
    .eq("profile_id", profile.id)
    .eq("status", "pending");

  if (cleanupError) {
    // Не критично: в худшем случае в списке будут старые рекомендации.
    console.warn(
      "[api/recommendations] Не удалось убрать прошлые рекомендации:",
      cleanupError,
    );
  }

  const { data: inserted, error: insertError } = await supabase
    .from("ai_recommendations")
    .insert(
      result.recommendations.map((item) => ({
        profile_id: profile.id,
        resource_type: item.resource_type,
        recommendation_text: item.recommendation_text,
        estimated_savings_resource: item.estimated_savings_resource,
        resource_unit: item.resource_unit,
        estimated_savings_tenge: item.estimated_savings_tenge,
        reasoning: item.reasoning,
      })),
    )
    .select();

  if (insertError) {
    console.error(
      "[api/recommendations] Рекомендации не сохранились:",
      insertError,
    );
    return serverError(
      "Рекомендации получены, но не сохранились. Попробуйте ещё раз.",
    );
  }

  return NextResponse.json(
    (inserted as AiRecommendation[] | null) ?? [],
    { status: 201 },
  );
}

/**
 * GET /api/recommendations?profile_id=<uuid>
 */
export async function GET(request: Request) {
  const profileId = new URL(request.url).searchParams.get("profile_id");

  if (!profileId) {
    return badRequest("Не передан параметр profile_id.");
  }

  if (!isValidProfileId(profileId)) {
    return badRequest("Параметр profile_id должен быть корректным uuid.");
  }

  const client = getClient();

  if (!client.ok) {
    return client.response;
  }

  const { data, error } = await client.supabase
    .from("ai_recommendations")
    .select("*")
    .eq("profile_id", profileId.trim())
    .order("generated_at", { ascending: false });

  if (error) {
    console.error(
      "[api/recommendations] Не удалось прочитать рекомендации:",
      error,
    );
    return serverError("Не удалось загрузить рекомендации. Попробуйте ещё раз.");
  }

  return NextResponse.json((data as AiRecommendation[] | null) ?? []);
}

/**
 * PATCH /api/recommendations
 * Тело: { id, status }
 */
export async function PATCH(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return badRequest("Тело запроса должно быть корректным JSON.");
  }

  if (typeof body !== "object" || body === null) {
    return badRequest("Тело запроса должно быть объектом.");
  }

  const { id, status } = body as Record<string, unknown>;

  if (!isValidProfileId(id)) {
    return badRequest("Поле id должно быть корректным uuid.");
  }

  if (!isRecommendationStatus(status)) {
    return badRequest(
      "Недопустимый статус. Допустимые значения: pending, applied, dismissed.",
    );
  }

  const client = getClient();

  if (!client.ok) {
    return client.response;
  }

  const { data, error } = await client.supabase
    .from("ai_recommendations")
    .update({ status })
    .eq("id", id.trim())
    .select()
    .maybeSingle<AiRecommendation>();

  if (error) {
    console.error("[api/recommendations] Статус не обновился:", error);
    return serverError("Не удалось обновить статус. Попробуйте ещё раз.");
  }

  if (!data) {
    return notFound("Рекомендация не найдена.");
  }

  return NextResponse.json(data);
}
