/**
 * AI-модуль рекомендаций.
 *
 * Два принципа:
 *
 * 1. Модель не считает деньги — только натуральное выражение (кВт·ч, м³, кг).
 *    Тенге считает lib/tariffs.ts.
 * 2. Ответ модели — недоверенные данные. Схема задана через
 *    output_config.format, но защитный парсинг всё равно есть: невалидный
 *    элемент отбрасывается, весь ответ при этом не рушится.
 */

import Anthropic from "@anthropic-ai/sdk";

import { calculateSavingsTenge, RESOURCE_UNITS } from "@/lib/tariffs";
import {
  isResourceType,
  RESOURCE_LABELS,
  type ObjectType,
  type Profile,
  type RegionalBenchmark,
  type ResourceBaseline,
  type ResourceType,
} from "@/lib/types";

/** Более сильная модель — `claude-opus-5`, замена сводится к правке строки. */
const AI_MODEL = "claude-sonnet-5";

/**
 * Меньше, чем maxDuration route handler'а: SDK должен прервать запрос раньше,
 * чем Vercel убьёт функцию, иначе пользователь останется без ответа.
 */
const REQUEST_TIMEOUT_MS = 55_000;

/** Меньше трёх — пустой дашборд, больше восьми — простыня. */
const MIN_RECOMMENDATIONS = 3;
const MAX_RECOMMENDATIONS = 8;

/** Рекомендация в том виде, в каком она уходит в БД. */
export interface GeneratedRecommendation {
  resource_type: ResourceType;
  recommendation_text: string;
  estimated_savings_resource: number;
  resource_unit: string;
  estimated_savings_tenge: number;
  reasoning: string;
}

/** Причина сбоя: route handler переводит её в код ответа и текст. */
export type GenerationFailureReason =
  | "not_configured"
  | "no_credit"
  | "timeout"
  | "rate_limited"
  | "api_error"
  | "empty_result";

export type GenerationResult =
  | { ok: true; recommendations: GeneratedRecommendation[] }
  | { ok: false; reason: GenerationFailureReason };

/**
 * Массив завёрнут в объект: json_schema ожидает объект на верхнем уровне.
 * Денежных полей нет намеренно — деньги считаем сами.
 */
const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    recommendations: {
      type: "array",
      // minItems/maxItems здесь не задать: structured outputs принимают
      // minItems только 0 или 1 и отвергают остальное с 400. Нужное
      // количество просим в промпте, верхнюю границу дожимаем в коде.
      items: {
        type: "object",
        properties: {
          resource_type: {
            type: "string",
            enum: ["electricity", "water", "waste"],
          },
          recommendation_text: {
            type: "string",
            description:
              "Конкретное действие на русском языке, 1-2 предложения.",
          },
          estimated_savings_resource: {
            type: "number",
            description:
              "Экономия за месяц в единицах ресурса. Только натуральное выражение, не деньги.",
          },
          resource_unit: {
            type: "string",
            enum: ["кВт·ч/мес", "м³/мес", "кг/мес"],
          },
          reasoning: {
            type: "string",
            description:
              "Почему это сработает именно для этого объекта, со ссылкой на его цифры.",
          },
        },
        required: [
          "resource_type",
          "recommendation_text",
          "estimated_savings_resource",
          "resource_unit",
          "reasoning",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["recommendations"],
  additionalProperties: false,
} as const;

const SYSTEM_PROMPT = `Ты — эксперт по ресурсоэффективности объектов в Казахстане: инженер-энергоаудитор с опытом обследования жилых домов, школ и малого бизнеса.

Тебе дают карточку объекта: тип, регион, текущее месячное потребление по ресурсам и средний показатель по региону для похожих объектов. Твоя задача — предложить конкретные меры по снижению потребления.

Правила, обязательные к соблюдению:

1. Каждая рекомендация опирается на конкретные цифры объекта. Если объект тратит 6200 кВт·ч при норме 4800, отталкивайся от этого перерасхода в 1400 кВт·ч и объясняй, откуда он берётся у объекта такого типа.
2. Рекомендация — это действие, а не пожелание. «Экономьте воду», «следите за расходом», «повышайте осведомлённость» — запрещены. Пиши, что именно сделать: что заменить, что настроить, что регламентировать.
3. Приоритет ресурсам с наибольшим отклонением от нормы. Если по ресурсу потребление ниже среднего, рекомендацию по нему давай только если она действительно даёт эффект, и признавай, что объект уже в норме.
4. Меры должны быть реалистичны для Казахстана: доступное оборудование, местный климат (холодные зимы на севере и западе, жара на юге), типовая застройка, реальные практики эксплуатации.
5. Учитывай тип объекта. Для школы уместны регламенты, расписание отопления и освещения, работа с персоналом и учащимися. Для бизнеса — оборудование, режимы работы, договоры на вывоз отходов. Для дома — бытовые приборы, сантехника, утепление.
6. Оценка экономии — только в натуральном выражении, в тех же единицах, что и потребление. Не считай деньги, не упоминай тенге: расчёт стоимости делает система по актуальным тарифам.
7. Оценка экономии должна быть честной и не может превышать текущее потребление по этому ресурсу. Лучше умеренная и достижимая цифра, чем красивая и фантастическая.
8. Пиши на русском языке, деловым тоном, без маркетинговых восклицаний.

В поле reasoning объясняй механику: за счёт чего именно возникает экономия и почему цифра именно такая.`;

/** Лениво: без ключа модуль не должен падать при импорте. */
let anthropicClient: Anthropic | null = null;

function getAnthropicClient(): Anthropic | null {
  if (anthropicClient) {
    return anthropicClient;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey || apiKey.trim() === "") {
    return null;
  }

  anthropicClient = new Anthropic({
    apiKey: apiKey.trim(),
    timeout: REQUEST_TIMEOUT_MS,
    maxRetries: 1,
  });

  return anthropicClient;
}

function roundToTenth(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Карточка объекта для модели. Отклонение считаем сами, чтобы модель не тратила
 * внимание на арифметику и не ошибалась в ней.
 */
function buildUserPrompt(
  profile: Profile,
  baselines: ResourceBaseline[],
  benchmarks: RegionalBenchmark[],
): string {
  const objectTypeNames: Record<ObjectType, string> = {
    household: "домохозяйство (квартира или частный дом)",
    school: "образовательное учреждение (школа)",
    business: "малый бизнес (офис, кафе, магазин или небольшое производство)",
  };

  const lines: string[] = [
    "КАРТОЧКА ОБЪЕКТА",
    `Название: ${profile.name}`,
    `Тип: ${objectTypeNames[profile.object_type]}`,
    `Регион: ${profile.region}`,
    "",
    "ПОТРЕБЛЕНИЕ ЗА МЕСЯЦ",
  ];

  for (const baseline of baselines) {
    const benchmark = benchmarks.find(
      (item) => item.resource_type === baseline.resource_type,
    );

    const label = RESOURCE_LABELS[baseline.resource_type];
    const unit = baseline.unit || RESOURCE_UNITS[baseline.resource_type];

    if (!benchmark || benchmark.avg_value <= 0) {
      lines.push(
        `- ${label}: ${baseline.value} ${unit}. Среднего показателя по региону нет — оценивай по типу объекта.`,
      );
      continue;
    }

    const deviation =
      ((baseline.value - benchmark.avg_value) / benchmark.avg_value) * 100;
    const verdict =
      deviation > 0
        ? `перерасход ${roundToTenth(Math.abs(deviation))}% относительно нормы`
        : deviation < 0
          ? `ниже нормы на ${roundToTenth(Math.abs(deviation))}%`
          : "ровно на уровне нормы";

    lines.push(
      `- ${label}: ${baseline.value} ${unit}. ` +
        `Средний показатель по региону для такого объекта: ${benchmark.avg_value} ${benchmark.unit}. ` +
        `Итог: ${verdict}.`,
    );
  }

  const missing = (["electricity", "water", "waste"] as ResourceType[]).filter(
    (resource) => !baselines.some((item) => item.resource_type === resource),
  );

  if (missing.length > 0) {
    lines.push(
      "",
      `Данных нет по ресурсам: ${missing
        .map((resource) => RESOURCE_LABELS[resource])
        .join(", ")}. Рекомендации по ним не давай.`,
    );
  }

  lines.push(
    "",
    `Предложи от ${MIN_RECOMMENDATIONS} до ${MAX_RECOMMENDATIONS} рекомендаций для этого объекта.`,
    "Начни с ресурса, где перерасход самый заметный.",
  );

  return lines.join("\n");
}

/** Страховка на случай, если structured outputs по какой-то причине не сработали. */
function stripMarkdownFences(raw: string): string {
  const trimmed = raw.trim();

  if (!trimmed.startsWith("```")) {
    return trimmed;
  }

  return trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```$/, "")
    .trim();
}

/** Принимает и объект со свойством `recommendations`, и голый массив. */
function extractItems(parsed: unknown): unknown[] {
  if (Array.isArray(parsed)) {
    return parsed;
  }

  if (typeof parsed === "object" && parsed !== null) {
    const candidate = (parsed as { recommendations?: unknown }).recommendations;

    if (Array.isArray(candidate)) {
      return candidate;
    }
  }

  return [];
}

/**
 * @param baselineByResource текущее потребление — по нему отсекаются заявки на
 *        экономию больше, чем объект вообще тратит: это невозможно физически и
 *        подрывает доверие к цифре на дашборде.
 * @returns null для невалидного элемента; остальные от этого не страдают.
 */
function validateItem(
  raw: unknown,
  baselineByResource: Map<ResourceType, number>,
): GeneratedRecommendation | null {
  if (typeof raw !== "object" || raw === null) {
    return null;
  }

  const item = raw as Record<string, unknown>;

  if (!isResourceType(item.resource_type)) {
    return null;
  }

  const resourceType = item.resource_type;

  if (
    typeof item.recommendation_text !== "string" ||
    item.recommendation_text.trim() === ""
  ) {
    return null;
  }

  const savings = item.estimated_savings_resource;

  if (typeof savings !== "number" || !Number.isFinite(savings) || savings <= 0) {
    return null;
  }

  const baseline = baselineByResource.get(resourceType);

  if (baseline !== undefined && savings > baseline) {
    console.warn(
      `[ai/recommendations] Отброшена рекомендация по ${resourceType}: ` +
        `заявлена экономия ${savings} при потреблении ${baseline}.`,
    );
    return null;
  }

  const roundedSavings = roundToTenth(savings);

  return {
    resource_type: resourceType,
    recommendation_text: item.recommendation_text.trim(),
    estimated_savings_resource: roundedSavings,
    // Единицу берём свою: если модель прислала «кВт/ч» вместо «кВт·ч/мес»,
    // на дашборде это выглядит как ошибка продукта.
    resource_unit: RESOURCE_UNITS[resourceType],
    estimated_savings_tenge: calculateSavingsTenge(resourceType, roundedSavings),
    reasoning:
      typeof item.reasoning === "string" && item.reasoning.trim() !== ""
        ? item.reasoning.trim()
        : "",
  };
}

function extractText(message: Anthropic.Message): string {
  return message.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");
}

/**
 * Никогда не бросает исключение: при любом сбое возвращает `{ ok: false }` с
 * причиной. Белого экрана из-за недоступного AI быть не должно.
 */
export async function generateRecommendations(
  profile: Profile,
  baselines: ResourceBaseline[],
  benchmarks: RegionalBenchmark[],
): Promise<GenerationResult> {
  const client = getAnthropicClient();

  if (!client) {
    console.error("[ai/recommendations] ANTHROPIC_API_KEY не задан");
    return { ok: false, reason: "not_configured" };
  }

  if (baselines.length === 0) {
    console.error("[ai/recommendations] У профиля нет ни одного показателя");
    return { ok: false, reason: "empty_result" };
  }

  const baselineByResource = new Map<ResourceType, number>(
    baselines.map((item) => [item.resource_type, item.value]),
  );

  let message: Anthropic.Message;

  try {
    message = await client.messages.create({
      model: AI_MODEL,
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      // Adaptive thinking: на Sonnet 5 это единственный режим включённого
      // размышления, budget_tokens там отвергается с 400.
      thinking: { type: "adaptive" },
      output_config: {
        // medium, а не high: качества для этой задачи достаточно, а лимит по
        // времени у серверлесс-функции реальный.
        effort: "medium",
        format: { type: "json_schema", schema: RESPONSE_SCHEMA },
      },
      messages: [
        {
          role: "user",
          content: buildUserPrompt(profile, baselines, benchmarks),
        },
      ],
    });
  } catch (error) {
    if (error instanceof Anthropic.APIConnectionTimeoutError) {
      console.error("[ai/recommendations] Таймаут запроса к Anthropic");
      return { ok: false, reason: "timeout" };
    }

    if (error instanceof Anthropic.RateLimitError) {
      console.error("[ai/recommendations] Достигнут лимит запросов Anthropic");
      return { ok: false, reason: "rate_limited" };
    }

    if (error instanceof Anthropic.AuthenticationError) {
      console.error("[ai/recommendations] Ключ Anthropic отклонён");
      return { ok: false, reason: "not_configured" };
    }

    // Исчерпанный баланс приходит как 400 invalid_request_error, а не как
    // отдельный класс ошибки. Без этой ветки пользователь видел бы «сервис
    // временно недоступен» и жал бы «Повторить» до бесконечности — на самом
    // деле нужно пополнить счёт.
    if (
      error instanceof Anthropic.BadRequestError &&
      /credit balance|billing/i.test(error.message)
    ) {
      console.error("[ai/recommendations] Недостаточно кредитов Anthropic");
      return { ok: false, reason: "no_credit" };
    }

    console.error("[ai/recommendations] Запрос к Anthropic не удался:", error);
    return { ok: false, reason: "api_error" };
  }

  if (message.stop_reason === "refusal") {
    console.error(
      "[ai/recommendations] Модель отказалась отвечать:",
      message.stop_details,
    );
    return { ok: false, reason: "api_error" };
  }

  const text = extractText(message);

  if (text.trim() === "") {
    console.error("[ai/recommendations] Пустой ответ модели");
    return { ok: false, reason: "empty_result" };
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(stripMarkdownFences(text));
  } catch (error) {
    console.error(
      "[ai/recommendations] Ответ модели не разобрался как JSON:",
      error,
      text.slice(0, 500),
    );
    return { ok: false, reason: "empty_result" };
  }

  const items = extractItems(parsed);
  const recommendations: GeneratedRecommendation[] = [];

  for (const item of items) {
    const validated = validateItem(item, baselineByResource);

    if (validated) {
      recommendations.push(validated);
    }
  }

  if (recommendations.length === 0) {
    console.error(
      "[ai/recommendations] Ни один элемент ответа не прошёл валидацию:",
      text.slice(0, 500),
    );
    return { ok: false, reason: "empty_result" };
  }

  // Самое ценное — вверх: дашборд показывает список как есть.
  recommendations.sort(
    (a, b) => b.estimated_savings_tenge - a.estimated_savings_tenge,
  );

  // Верхняя граница схемой не задаётся, поэтому режем здесь: список из
  // полутора десятков пунктов дашборд превращает в простыню.
  return {
    ok: true,
    recommendations: recommendations.slice(0, MAX_RECOMMENDATIONS),
  };
}
