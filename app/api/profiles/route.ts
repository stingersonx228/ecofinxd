/**
 * /api/profiles — создание и чтение профиля объекта.
 *
 * POST — создаёт профиль вместе с показателями потребления одной транзакцией
 *        (RPC create_profile_with_baselines, см. supabase/schema.sql).
 * GET  — возвращает профиль вместе с его baselines по ?id=.
 */

import { NextResponse } from "next/server";

import { isValidProfileId } from "@/lib/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { RESOURCE_UNITS } from "@/lib/tariffs";
import {
  isObjectType,
  isResourceType,
  type Profile,
  type ProfileWithBaselines,
  type ResourceBaseline,
  type ResourceType,
} from "@/lib/types";

/** Длиннее — почти наверняка вставленный по ошибке текст, а не название. */
const MAX_NAME_LENGTH = 120;
const MAX_REGION_LENGTH = 120;

/**
 * Верхняя граница месячного потребления. Не физический предел, а защита от
 * опечатки в лишний ноль: такие числа ломают и график, и оценку экономии.
 */
const MAX_RESOURCE_VALUE = 10_000_000;

/** Показатель потребления в том виде, в каком он уходит в RPC. */
interface BaselineInput {
  resource_type: ResourceType;
  value: number;
  unit: string;
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function notFound(message: string) {
  return NextResponse.json({ error: message }, { status: 404 });
}

function serverError(message: string) {
  return NextResponse.json({ error: message }, { status: 500 });
}

/**
 * Приводит значение потребления к числу.
 *
 * Из формы приходит строка, из чужого клиента — что угодно. Пустая строка,
 * NaN, Infinity и отрицательные значения считаются невалидными.
 */
function parseResourceValue(raw: unknown): number | null {
  if (typeof raw === "number") {
    return Number.isFinite(raw) ? raw : null;
  }

  if (typeof raw === "string") {
    const normalized = raw.trim().replace(",", ".");

    if (normalized === "") {
      return null;
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

/**
 * Валидирует массив показателей потребления.
 *
 * Единицу измерения берём из RESOURCE_UNITS, а не из запроса: клиент не должен
 * иметь возможности записать «кВт·ч» там, где на дашборде ожидается «м³».
 */
function parseBaselines(
  raw: unknown,
): { baselines: BaselineInput[] } | { error: string } {
  if (!Array.isArray(raw)) {
    return { error: "Поле baselines должно быть массивом." };
  }

  if (raw.length === 0) {
    return { error: "Укажите потребление хотя бы по одному ресурсу." };
  }

  const baselines: BaselineInput[] = [];
  const seen = new Set<ResourceType>();

  for (const item of raw) {
    if (typeof item !== "object" || item === null) {
      return { error: "Каждый элемент baselines должен быть объектом." };
    }

    const { resource_type: resourceType, value } = item as Record<
      string,
      unknown
    >;

    if (!isResourceType(resourceType)) {
      return {
        error:
          "Недопустимый тип ресурса. Допустимые значения: electricity, water, waste.",
      };
    }

    if (seen.has(resourceType)) {
      return { error: `Ресурс «${resourceType}» указан дважды.` };
    }

    const parsedValue = parseResourceValue(value);

    if (parsedValue === null) {
      return {
        error: `Потребление по ресурсу «${resourceType}» должно быть числом.`,
      };
    }

    if (parsedValue < 0) {
      return {
        error: `Потребление по ресурсу «${resourceType}» не может быть отрицательным.`,
      };
    }

    if (parsedValue > MAX_RESOURCE_VALUE) {
      return {
        error: `Потребление по ресурсу «${resourceType}» выглядит неправдоподобно большим. Проверьте число.`,
      };
    }

    seen.add(resourceType);
    baselines.push({
      resource_type: resourceType,
      value: parsedValue,
      unit: RESOURCE_UNITS[resourceType],
    });
  }

  return { baselines };
}

/**
 * POST /api/profiles
 *
 * Тело: { object_type, name, region, baselines: [{ resource_type, value }] }
 * Ответ 201: профиль вместе с сохранёнными baselines.
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

  const {
    object_type: objectType,
    name,
    region,
    baselines: rawBaselines,
  } = body as Record<string, unknown>;

  if (!isObjectType(objectType)) {
    return badRequest(
      "Недопустимый тип объекта. Допустимые значения: household, school, business.",
    );
  }

  if (typeof name !== "string" || name.trim() === "") {
    return badRequest("Укажите название объекта.");
  }

  if (name.trim().length > MAX_NAME_LENGTH) {
    return badRequest(
      `Название объекта не должно быть длиннее ${MAX_NAME_LENGTH} символов.`,
    );
  }

  if (typeof region !== "string" || region.trim() === "") {
    return badRequest("Укажите регион.");
  }

  if (region.trim().length > MAX_REGION_LENGTH) {
    return badRequest(
      `Название региона не должно быть длиннее ${MAX_REGION_LENGTH} символов.`,
    );
  }

  const parsed = parseBaselines(rawBaselines);

  if ("error" in parsed) {
    return badRequest(parsed.error);
  }

  let supabase;

  try {
    supabase = createSupabaseServerClient();
  } catch (error) {
    console.error("[api/profiles] Supabase не сконфигурирован:", error);
    return serverError(
      "Сервис временно недоступен: не настроено подключение к базе данных.",
    );
  }

  const { data: profile, error } = await supabase
    .rpc("create_profile_with_baselines", {
      p_object_type: objectType,
      p_name: name.trim(),
      p_region: region.trim(),
      p_baselines: parsed.baselines,
    })
    .single<Profile>();

  if (error) {
    console.error("[api/profiles] Не удалось создать профиль:", error);

    // 23514 — нарушение CHECK-констрейнта: данные не прошли проверку на уровне
    // БД, значит виноват запрос, а не сервер.
    if (error.code === "23514") {
      return badRequest(
        "Данные не прошли проверку базы данных. Проверьте тип объекта и значения потребления.",
      );
    }

    return serverError("Не удалось сохранить профиль. Попробуйте ещё раз.");
  }

  if (!profile) {
    console.error("[api/profiles] RPC вернул пустой результат");
    return serverError("Не удалось сохранить профиль. Попробуйте ещё раз.");
  }

  // Читаем baselines из БД, а не отдаём то, что прислал клиент: так ответ
  // отражает реально сохранённое состояние.
  const { data: baselines, error: baselinesError } = await supabase
    .from("resource_baselines")
    .select("*")
    .eq("profile_id", profile.id)
    .order("created_at", { ascending: true });

  if (baselinesError) {
    console.error(
      "[api/profiles] Профиль создан, но baselines не прочитались:",
      baselinesError,
    );
  }

  const payload: ProfileWithBaselines = {
    ...profile,
    baselines: (baselines as ResourceBaseline[] | null) ?? [],
  };

  return NextResponse.json(payload, { status: 201 });
}

/**
 * GET /api/profiles?id=<uuid>
 *
 * Ответ 200: профиль вместе с baselines. 404, если профиля нет.
 */
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id");

  if (!id) {
    return badRequest("Не передан параметр id.");
  }

  if (!isValidProfileId(id)) {
    return badRequest("Параметр id должен быть корректным uuid.");
  }

  let supabase;

  try {
    supabase = createSupabaseServerClient();
  } catch (error) {
    console.error("[api/profiles] Supabase не сконфигурирован:", error);
    return serverError(
      "Сервис временно недоступен: не настроено подключение к базе данных.",
    );
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id.trim())
    .maybeSingle<Profile>();

  if (error) {
    console.error("[api/profiles] Не удалось прочитать профиль:", error);
    return serverError("Не удалось загрузить профиль. Попробуйте ещё раз.");
  }

  if (!profile) {
    return notFound("Профиль не найден.");
  }

  const { data: baselines, error: baselinesError } = await supabase
    .from("resource_baselines")
    .select("*")
    .eq("profile_id", profile.id)
    .order("created_at", { ascending: true });

  if (baselinesError) {
    console.error(
      "[api/profiles] Не удалось прочитать baselines:",
      baselinesError,
    );
    return serverError(
      "Не удалось загрузить данные о потреблении. Попробуйте ещё раз.",
    );
  }

  const payload: ProfileWithBaselines = {
    ...profile,
    baselines: (baselines as ResourceBaseline[] | null) ?? [],
  };

  return NextResponse.json(payload);
}
