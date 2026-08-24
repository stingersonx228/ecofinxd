/**
 * /api/org-units — подразделения организации.
 *
 * GET  ?profile_id=<uuid>  — список подразделений профиля.
 * POST { profile_id, unit_name, resource_type, baseline_value } — добавить.
 *
 * Подразделение хранится по одной строке на ресурс: у «Корпуса А» может быть
 * отдельная строка по электричеству и отдельная по воде. Страница собирает из
 * них таблицу.
 */

import { NextResponse } from "next/server";

import { isValidProfileId } from "@/lib/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { RESOURCE_UNITS } from "@/lib/tariffs";
import {
  hasOrgUnits,
  isResourceType,
  type OrgUnit,
  type Profile,
} from "@/lib/types";

const MAX_UNIT_NAME_LENGTH = 120;
const MAX_RESOURCE_VALUE = 10_000_000;

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function notFound(message: string) {
  return NextResponse.json({ error: message }, { status: 404 });
}

function serverError(message: string) {
  return NextResponse.json({ error: message }, { status: 500 });
}

/** Из формы приходит строка; запятая как разделитель тоже допустима. */
function parseValue(raw: unknown): number | null {
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
 * GET /api/org-units?profile_id=<uuid>
 */
export async function GET(request: Request) {
  const profileId = new URL(request.url).searchParams.get("profile_id");

  if (!profileId) {
    return badRequest("Не передан параметр profile_id.");
  }

  if (!isValidProfileId(profileId)) {
    return badRequest("Параметр profile_id должен быть корректным uuid.");
  }

  let supabase;

  try {
    supabase = createSupabaseServerClient();
  } catch (error) {
    console.error("[api/org-units] Supabase не сконфигурирован:", error);
    return serverError(
      "Сервис временно недоступен: не настроено подключение к базе данных.",
    );
  }

  const { data, error } = await supabase
    .from("org_units")
    .select("*")
    .eq("profile_id", profileId.trim())
    .order("unit_name", { ascending: true })
    .order("resource_type", { ascending: true });

  if (error) {
    console.error("[api/org-units] Подразделения не прочитались:", error);
    return serverError(
      "Не удалось загрузить подразделения. Попробуйте ещё раз.",
    );
  }

  return NextResponse.json((data as OrgUnit[] | null) ?? []);
}

/**
 * POST /api/org-units
 * Тело: { profile_id, unit_name, resource_type, baseline_value }
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
    profile_id: profileId,
    unit_name: unitName,
    resource_type: resourceType,
    baseline_value: baselineValue,
  } = body as Record<string, unknown>;

  if (!isValidProfileId(profileId)) {
    return badRequest("Поле profile_id должно быть корректным uuid.");
  }

  if (typeof unitName !== "string" || unitName.trim() === "") {
    return badRequest("Укажите название подразделения.");
  }

  if (unitName.trim().length > MAX_UNIT_NAME_LENGTH) {
    return badRequest(
      `Название подразделения не должно быть длиннее ${MAX_UNIT_NAME_LENGTH} символов.`,
    );
  }

  if (!isResourceType(resourceType)) {
    return badRequest(
      "Недопустимый тип ресурса. Допустимые значения: electricity, water, waste.",
    );
  }

  const value = parseValue(baselineValue);

  if (value === null) {
    return badRequest("Потребление должно быть числом.");
  }

  if (value < 0) {
    return badRequest("Потребление не может быть отрицательным.");
  }

  if (value > MAX_RESOURCE_VALUE) {
    return badRequest(
      "Потребление выглядит неправдоподобно большим. Проверьте число.",
    );
  }

  let supabase;

  try {
    supabase = createSupabaseServerClient();
  } catch (error) {
    console.error("[api/org-units] Supabase не сконфигурирован:", error);
    return serverError(
      "Сервис временно недоступен: не настроено подключение к базе данных.",
    );
  }

  // Подразделения есть только у организаций. Без этой проверки к домохозяйству
  // можно было бы прицепить «отделы» в обход интерфейса.
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", profileId)
    .maybeSingle<Profile>();

  if (profileError) {
    console.error("[api/org-units] Профиль не прочитался:", profileError);
    return serverError("Не удалось загрузить профиль. Попробуйте ещё раз.");
  }

  if (!profile) {
    return notFound("Профиль не найден.");
  }

  if (!hasOrgUnits(profile.object_type)) {
    return badRequest(
      "Подразделения доступны только для школ и бизнеса, у домохозяйства их нет.",
    );
  }

  const { data, error } = await supabase
    .from("org_units")
    .insert({
      profile_id: profile.id,
      unit_name: unitName.trim(),
      resource_type: resourceType,
      baseline_value: value,
      // Единицу измерения проставляет сервер: клиент не должен иметь
      // возможности записать «кВт·ч» в строку с водой.
      unit: RESOURCE_UNITS[resourceType],
    })
    .select()
    .single<OrgUnit>();

  if (error) {
    console.error("[api/org-units] Подразделение не сохранилось:", error);
    return serverError(
      "Не удалось сохранить подразделение. Попробуйте ещё раз.",
    );
  }

  return NextResponse.json(data, { status: 201 });
}
