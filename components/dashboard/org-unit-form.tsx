"use client";

/**
 * Форма добавления подразделения.
 *
 * Одна строка — это подразделение плюс один ресурс. Чтобы завести «Корпус А» и
 * по электричеству, и по воде, форму заполняют дважды; название после отправки
 * намеренно остаётся в поле, потому что следующий ввод почти всегда тот же
 * корпус, но другой ресурс.
 */

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import { RESOURCE_UNITS } from "@/lib/tariffs";
import {
  ORG_UNIT_LABELS,
  RESOURCE_LABELS,
  RESOURCE_TYPES,
  type ObjectType,
  type ResourceType,
} from "@/lib/types";

export function OrgUnitForm({
  profileId,
  objectType,
}: {
  profileId: string;
  objectType: ObjectType;
}) {
  const router = useRouter();

  const [unitName, setUnitName] = useState("");
  const [resourceType, setResourceType] = useState<ResourceType>("electricity");
  const [value, setValue] = useState("");

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const [isSubmitting, startSubmitting] = useTransition();

  function validate(): boolean {
    const errors: Record<string, string> = {};

    if (unitName.trim() === "") {
      errors.unitName = "Укажите название.";
    } else if (unitName.trim().length > 120) {
      errors.unitName = "Не длиннее 120 символов.";
    }

    const parsed = Number(value.trim().replace(",", "."));

    if (value.trim() === "" || !Number.isFinite(parsed)) {
      errors.value = "Введите число.";
    } else if (parsed < 0) {
      errors.value = "Не может быть отрицательным.";
    } else if (parsed > 10_000_000) {
      errors.value = "Проверьте число.";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();

    setSubmitError(null);
    setSavedNotice(null);

    if (!validate()) {
      return;
    }

    startSubmitting(async () => {
      try {
        const response = await fetch("/api/org-units", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            profile_id: profileId,
            unit_name: unitName.trim(),
            resource_type: resourceType,
            baseline_value: value.trim().replace(",", "."),
          }),
        });

        if (!response.ok) {
          const payload: unknown = await response.json().catch(() => null);
          const message =
            payload &&
            typeof payload === "object" &&
            typeof (payload as { error?: unknown }).error === "string"
              ? (payload as { error: string }).error
              : "Не удалось сохранить подразделение. Попробуйте ещё раз.";

          setSubmitError(message);
          return;
        }

        setSavedNotice(
          `Добавлено: ${unitName.trim()} — ${RESOURCE_LABELS[resourceType].toLowerCase()}.`,
        );
        // Название оставляем, значение чистим: следующий ввод — тот же объект,
        // но другой ресурс.
        setValue("");
        router.refresh();
      } catch {
        setSubmitError(
          "Не удалось связаться с сервером. Проверьте интернет и попробуйте ещё раз.",
        );
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="rounded-xl border border-border bg-surface p-4 sm:p-6"
    >
      <h2 className="text-lg font-semibold">Добавить подразделение</h2>

      <div className="mt-4 grid gap-4 sm:grid-cols-[2fr_1fr_1fr]">
        <div>
          <label htmlFor="unit-name" className="block text-sm font-medium">
            {ORG_UNIT_LABELS[objectType]}
          </label>
          <input
            id="unit-name"
            type="text"
            value={unitName}
            maxLength={120}
            onChange={(event) => setUnitName(event.target.value)}
            placeholder={
              objectType === "school" ? "Например: Корпус А" : "Например: Кухня"
            }
            aria-invalid={Boolean(fieldErrors.unitName)}
            className="mt-2 w-full rounded-lg border border-border bg-surface px-3 py-2 outline-none focus:border-brand-600 focus:ring-1 focus:ring-brand-600"
          />
          {fieldErrors.unitName ? (
            <p className="mt-1 text-sm text-over">{fieldErrors.unitName}</p>
          ) : null}
        </div>

        <div>
          <label htmlFor="unit-resource" className="block text-sm font-medium">
            Ресурс
          </label>
          <select
            id="unit-resource"
            value={resourceType}
            onChange={(event) =>
              setResourceType(event.target.value as ResourceType)
            }
            className="mt-2 w-full rounded-lg border border-border bg-surface px-3 py-2 outline-none focus:border-brand-600 focus:ring-1 focus:ring-brand-600"
          >
            {RESOURCE_TYPES.map((item) => (
              <option key={item} value={item}>
                {RESOURCE_LABELS[item]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="unit-value" className="block text-sm font-medium">
            Потребление
          </label>
          <div className="mt-2 flex items-stretch">
            <input
              id="unit-value"
              type="text"
              inputMode="decimal"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder="0"
              aria-invalid={Boolean(fieldErrors.value)}
              className="w-full min-w-0 rounded-l-lg border border-border bg-surface px-3 py-2 outline-none focus:border-brand-600 focus:ring-1 focus:ring-brand-600"
            />
            <span className="flex items-center whitespace-nowrap rounded-r-lg border border-l-0 border-border bg-brand-50 px-2 text-xs text-muted">
              {RESOURCE_UNITS[resourceType]}
            </span>
          </div>
          {fieldErrors.value ? (
            <p className="mt-1 text-sm text-over">{fieldErrors.value}</p>
          ) : null}
        </div>
      </div>

      {submitError ? (
        <div
          role="alert"
          className="mt-4 rounded-lg border border-over/30 bg-over/5 px-4 py-3 text-sm text-over"
        >
          {submitError}
        </div>
      ) : null}

      {savedNotice ? (
        <p role="status" className="mt-4 text-sm text-under">
          {savedNotice}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-4 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "Сохраняем…" : "Добавить"}
      </button>
    </form>
  );
}
