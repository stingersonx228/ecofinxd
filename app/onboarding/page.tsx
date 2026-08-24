"use client";

/**
 * Онбординг — входная точка данных.
 *
 * Шаг 1: что за объект (тип, название, регион).
 * Шаг 2: сколько он потребляет сейчас.
 *
 * Введённые данные живут в состоянии страницы и не теряются ни при переходе
 * между шагами, ни при ошибке отправки: повторная попытка не должна означать
 * повторный ввод.
 */

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { setProfileId } from "@/lib/profile";
import { useProfileId } from "@/lib/use-profile-id";
import { DEFAULT_REGION, hasOwnBenchmarks, KZ_REGIONS } from "@/lib/regions";
import { RESOURCE_UNITS } from "@/lib/tariffs";
import {
  OBJECT_TYPES,
  OBJECT_TYPE_LABELS,
  type ObjectType,
  type ProfileWithBaselines,
  type ResourceType,
} from "@/lib/types";

type Step = 1 | 2;

/** Подсказки под карточками выбора типа объекта. */
const OBJECT_TYPE_HINTS: Record<ObjectType, string> = {
  household: "Квартира или частный дом",
  school: "Школа, колледж, детский сад",
  business: "Офис, кафе, магазин, цех",
};

/** Что писать в placeholder названия — зависит от типа объекта. */
const NAME_PLACEHOLDERS: Record<ObjectType, string> = {
  household: "Например: Квартира на Достык 15",
  school: "Например: Школа-гимназия №21",
  business: "Например: Кофейня «Астра»",
};

interface ResourceField {
  key: ResourceType;
  label: string;
  hint: string;
  required: boolean;
}

const RESOURCE_FIELDS: ResourceField[] = [
  {
    key: "electricity",
    label: "Электричество",
    hint: "Из квитанции за последний месяц",
    required: true,
  },
  {
    key: "water",
    label: "Вода",
    hint: "Холодная и горячая суммарно",
    required: true,
  },
  {
    key: "waste",
    label: "Отходы",
    hint: "Если не знаете — оставьте пустым",
    required: false,
  },
];

/** Строка из поля ввода в число: запятая как разделитель тоже допустима. */
function parseAmount(raw: string): number | null {
  const normalized = raw.trim().replace(",", ".");

  if (normalized === "") {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function OnboardingPage() {
  const router = useRouter();

  const [step, setStep] = useState<Step>(1);

  const [objectType, setObjectType] = useState<ObjectType | null>(null);
  const [name, setName] = useState("");
  const [region, setRegion] = useState<string>(DEFAULT_REGION);
  const [amounts, setAmounts] = useState<Record<ResourceType, string>>({
    electricity: "",
    water: "",
    waste: "",
  });

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  /** Профиль в этом браузере уже есть — предложим вернуться, а не заводить второй. */
  const existingProfileId = useProfileId();

  function setAmount(resource: ResourceType, value: string) {
    setAmounts((previous) => ({ ...previous, [resource]: value }));
    setFieldErrors((previous) => {
      if (!previous[resource]) {
        return previous;
      }
      const next = { ...previous };
      delete next[resource];
      return next;
    });
  }

  function validateStep1(): boolean {
    const errors: Record<string, string> = {};

    if (!objectType) {
      errors.objectType = "Выберите тип объекта.";
    }

    if (name.trim() === "") {
      errors.name = "Укажите название объекта.";
    } else if (name.trim().length > 120) {
      errors.name = "Название слишком длинное — не больше 120 символов.";
    }

    if (region.trim() === "") {
      errors.region = "Выберите регион.";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function validateStep2(): boolean {
    const errors: Record<string, string> = {};

    for (const field of RESOURCE_FIELDS) {
      const raw = amounts[field.key];
      const parsed = parseAmount(raw);

      if (parsed === null) {
        if (field.required) {
          errors[field.key] = "Заполните это поле.";
        }
        continue;
      }

      if (parsed < 0) {
        errors[field.key] = "Значение не может быть отрицательным.";
        continue;
      }

      if (field.required && parsed === 0) {
        errors[field.key] = "Значение должно быть больше нуля.";
        continue;
      }

      if (parsed > 10_000_000) {
        errors[field.key] = "Проверьте число — оно выглядит слишком большим.";
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function goToStep2() {
    if (validateStep1()) {
      setFieldErrors({});
      setStep(2);
    }
  }

  function goToStep1() {
    setFieldErrors({});
    setSubmitError(null);
    setStep(1);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    // Шаг 1 мог быть пройден до правки полей — проверяем оба.
    if (!validateStep1()) {
      setStep(1);
      return;
    }

    if (!validateStep2()) {
      return;
    }

    setSubmitError(null);
    setIsSubmitting(true);

    const baselines = RESOURCE_FIELDS.map((field) => ({
      resource_type: field.key,
      value: parseAmount(amounts[field.key]),
    })).filter(
      (item): item is { resource_type: ResourceType; value: number } =>
        item.value !== null,
    );

    try {
      const response = await fetch("/api/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          object_type: objectType,
          name: name.trim(),
          region: region.trim(),
          baselines,
        }),
      });

      const payload: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        const message =
          payload &&
          typeof payload === "object" &&
          typeof (payload as { error?: unknown }).error === "string"
            ? (payload as { error: string }).error
            : "Не удалось сохранить данные. Попробуйте ещё раз.";

        setSubmitError(message);
        return;
      }

      const profile = payload as ProfileWithBaselines | null;

      if (!profile?.id) {
        setSubmitError("Сервер вернул неожиданный ответ. Попробуйте ещё раз.");
        return;
      }

      // Если localStorage недоступен, profile_id всё равно есть в URL —
      // переход на дашборд блокировать незачем.
      setProfileId(profile.id);
      router.push(`/dashboard/${profile.id}`);
    } catch {
      setSubmitError(
        "Не удалось связаться с сервером. Проверьте интернет и попробуйте ещё раз.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const regionWithoutBenchmarks = region !== "" && !hasOwnBenchmarks(region);

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 sm:py-16">
      <header className="mb-8">
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

        <p className="mt-6 text-sm font-medium text-muted">Шаг {step} из 2</p>

        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
          {step === 1 ? "Расскажите об объекте" : "Текущее потребление"}
        </h1>

        <p className="mt-2 text-sm text-muted">
          {step === 1
            ? "Тип объекта и регион нужны, чтобы сравнить вас с похожими и подобрать рекомендации."
            : "Возьмите цифры из квитанций за последний месяц. Приблизительных достаточно — их можно уточнить позже."}
        </p>

        <div
          className="mt-6 h-1 w-full overflow-hidden rounded-full bg-brand-100"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={2}
          aria-valuenow={step}
          aria-label="Прогресс заполнения"
        >
          <div
            className="h-full rounded-full bg-brand-600 transition-all"
            style={{ width: step === 1 ? "50%" : "100%" }}
          />
        </div>
      </header>

      {existingProfileId && step === 1 ? (
        <p className="mb-6 rounded-lg border border-border bg-brand-50 px-4 py-3 text-sm">
          В этом браузере уже есть кабинет.{" "}
          <Link
            href={`/dashboard/${existingProfileId}`}
            className="font-medium text-brand-700 underline underline-offset-2 hover:text-brand-900"
          >
            Открыть его
          </Link>{" "}
          или заполните форму, чтобы добавить новый объект.
        </p>
      ) : null}

      <form onSubmit={handleSubmit} noValidate>
        {step === 1 ? (
          <div className="space-y-6">
            <fieldset>
              <legend className="text-sm font-medium">Тип объекта</legend>

              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {OBJECT_TYPES.map((type) => {
                  const isSelected = objectType === type;

                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => {
                        setObjectType(type);
                        setFieldErrors((previous) => {
                          const next = { ...previous };
                          delete next.objectType;
                          return next;
                        });
                      }}
                      aria-pressed={isSelected}
                      className={`rounded-xl border p-4 text-left transition-colors ${
                        isSelected
                          ? "border-brand-600 bg-brand-50 ring-1 ring-brand-600"
                          : "border-border bg-surface hover:border-brand-300"
                      }`}
                    >
                      <span className="block font-medium">
                        {OBJECT_TYPE_LABELS[type]}
                      </span>
                      <span className="mt-1 block text-xs text-muted">
                        {OBJECT_TYPE_HINTS[type]}
                      </span>
                    </button>
                  );
                })}
              </div>

              {fieldErrors.objectType ? (
                <p className="mt-2 text-sm text-over">
                  {fieldErrors.objectType}
                </p>
              ) : null}
            </fieldset>

            <div>
              <label htmlFor="name" className="block text-sm font-medium">
                Название объекта
              </label>

              <input
                id="name"
                type="text"
                value={name}
                maxLength={120}
                onChange={(event) => {
                  setName(event.target.value);
                  setFieldErrors((previous) => {
                    const next = { ...previous };
                    delete next.name;
                    return next;
                  });
                }}
                placeholder={
                  objectType
                    ? NAME_PLACEHOLDERS[objectType]
                    : "Как называется объект"
                }
                aria-invalid={Boolean(fieldErrors.name)}
                className="mt-2 w-full rounded-lg border border-border bg-surface px-3 py-2 outline-none focus:border-brand-600 focus:ring-1 focus:ring-brand-600"
              />

              {fieldErrors.name ? (
                <p className="mt-2 text-sm text-over">{fieldErrors.name}</p>
              ) : null}
            </div>

            <div>
              <label htmlFor="region" className="block text-sm font-medium">
                Регион
              </label>

              <select
                id="region"
                value={region}
                onChange={(event) => setRegion(event.target.value)}
                className="mt-2 w-full rounded-lg border border-border bg-surface px-3 py-2 outline-none focus:border-brand-600 focus:ring-1 focus:ring-brand-600"
              >
                {KZ_REGIONS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>

              {fieldErrors.region ? (
                <p className="mt-2 text-sm text-over">{fieldErrors.region}</p>
              ) : null}

              {regionWithoutBenchmarks ? (
                <p className="mt-2 text-xs text-muted">
                  По этому региону отдельных данных пока нет — сравним со
                  среднереспубликанскими показателями.
                </p>
              ) : null}
            </div>

            <button
              type="button"
              onClick={goToStep2}
              className="w-full rounded-lg bg-brand-600 px-4 py-3 font-medium text-white transition-colors hover:bg-brand-700 sm:w-auto sm:px-8"
            >
              Далее
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {RESOURCE_FIELDS.map((field) => (
              <div key={field.key}>
                <label
                  htmlFor={field.key}
                  className="block text-sm font-medium"
                >
                  {field.label}
                  {field.required ? null : (
                    <span className="ml-2 text-xs font-normal text-muted">
                      необязательно
                    </span>
                  )}
                </label>

                <div className="mt-2 flex items-stretch">
                  <input
                    id={field.key}
                    type="text"
                    inputMode="decimal"
                    value={amounts[field.key]}
                    onChange={(event) =>
                      setAmount(field.key, event.target.value)
                    }
                    placeholder="0"
                    aria-invalid={Boolean(fieldErrors[field.key])}
                    aria-describedby={`${field.key}-hint`}
                    className="w-full rounded-l-lg border border-border bg-surface px-3 py-2 outline-none focus:border-brand-600 focus:ring-1 focus:ring-brand-600"
                  />
                  <span className="flex items-center rounded-r-lg border border-l-0 border-border bg-brand-50 px-3 text-sm text-muted">
                    {RESOURCE_UNITS[field.key]}
                  </span>
                </div>

                <p id={`${field.key}-hint`} className="mt-2 text-xs text-muted">
                  {field.hint}
                </p>

                {fieldErrors[field.key] ? (
                  <p className="mt-1 text-sm text-over">
                    {fieldErrors[field.key]}
                  </p>
                ) : null}
              </div>
            ))}

            {submitError ? (
              <div
                role="alert"
                className="rounded-lg border border-over/30 bg-over/5 px-4 py-3 text-sm text-over"
              >
                {submitError}
              </div>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row-reverse">
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-lg bg-brand-600 px-4 py-3 font-medium text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60 sm:px-8"
              >
                {isSubmitting
                  ? "Сохраняем…"
                  : submitError
                    ? "Попробовать ещё раз"
                    : "Создать кабинет"}
              </button>

              <button
                type="button"
                onClick={goToStep1}
                disabled={isSubmitting}
                className="rounded-lg border border-border px-4 py-3 font-medium transition-colors hover:border-brand-300 disabled:cursor-not-allowed disabled:opacity-60 sm:px-8"
              >
                Назад
              </button>
            </div>
          </div>
        )}
      </form>
    </main>
  );
}
