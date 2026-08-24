/**
 * Лендинг. Серверный компонент; интерактивна только пара кнопок,
 * потому что «Мой кабинет» зависит от localStorage.
 */

import Image from "next/image";

import { CtaButtons } from "@/components/landing/cta-buttons";
import { formatTariff } from "@/lib/tariffs";

const AUDIENCES = [
  {
    title: "Домохозяйства",
    text: "Понять, почему счёт за электричество выше, чем у соседей с такой же квартирой, и что с этим сделать.",
    examples: "Квартиры, частные дома",
  },
  {
    title: "Школы",
    text: "Увидеть потребление в разрезе корпусов и классов и найти те, что тратят заметно больше остальных.",
    examples: "Школы, колледжи, детские сады",
  },
  {
    title: "Малый бизнес",
    text: "Сократить постоянные расходы без потери качества обслуживания и понять срок окупаемости мер.",
    examples: "Кафе, магазины, офисы, цеха",
  },
];

const STEPS = [
  {
    number: "1",
    title: "Введите показания",
    text: "Электричество, вода и отходы за последний месяц. Хватит цифр из квитанции.",
  },
  {
    number: "2",
    title: "AI сравнивает и анализирует",
    text: "Ваши цифры сопоставляются со средними по региону для объектов такого же типа. Claude предлагает конкретные меры под ваш объект.",
  },
  {
    number: "3",
    title: "Считаете экономию",
    text: "Каждая рекомендация переведена в тенге по тарифам. Отмечайте, что применили, и следите за суммой.",
  },
];

export default function LandingPage() {
  return (
    <main className="flex-1">
      {/* Первый экран */}
      <section className="mx-auto w-full max-w-5xl px-4 pt-16 pb-12 sm:px-6 sm:pt-24 sm:pb-16">
        <Image
          src="/logo.png"
          alt="EcoFin"
          width={555}
          height={200}
          priority
          className="h-auto w-[220px] sm:w-[270px]"
        />

        <h1 className="mt-7 max-w-3xl text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
          Показываем, где утекают ресурсы и сколько тенге можно вернуть
        </h1>

        <p className="mt-5 max-w-2xl text-lg text-muted">
          Введите текущее потребление — платформа сравнит его с нормой по вашему
          региону, найдёт перерасход и предложит конкретные шаги с расчётом
          экономии в тенге. Без датчиков и обследований: достаточно квитанции.
        </p>

        <div className="mt-8">
          <CtaButtons />
        </div>

        <p className="mt-4 text-sm text-muted">
          Без регистрации. Занимает около минуты.
        </p>
      </section>

      {/* Кому это нужно */}
      <section className="border-y border-border bg-surface">
        <div className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
          <h2 className="text-2xl font-semibold tracking-tight">
            Кому это нужно
          </h2>

          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            {AUDIENCES.map((audience) => (
              <article key={audience.title}>
                <h3 className="text-lg font-medium">{audience.title}</h3>
                <p className="mt-2 text-muted">{audience.text}</p>
                <p className="mt-3 text-sm text-brand-700">
                  {audience.examples}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Как это работает */}
      <section className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
        <h2 className="text-2xl font-semibold tracking-tight">
          Как это работает
        </h2>

        <ol className="mt-8 grid gap-8 sm:grid-cols-3">
          {STEPS.map((step) => (
            <li key={step.number}>
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 font-medium text-white">
                {step.number}
              </span>
              <h3 className="mt-4 text-lg font-medium">{step.title}</h3>
              <p className="mt-2 text-muted">{step.text}</p>
            </li>
          ))}
        </ol>

        <p className="mt-8 max-w-2xl text-sm text-muted">
          Экономию в деньгах считает не модель, а сама платформа по тарифам:{" "}
          {formatTariff("electricity")}, {formatTariff("water")},{" "}
          {formatTariff("waste")}. Тарифы и региональные средние в этой версии —
          примерные значения, они указаны в README.
        </p>
      </section>

      {/* Нижний призыв */}
      <section className="border-t border-border bg-brand-800">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-6 px-4 py-12 sm:px-6 sm:py-14">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-white">
              Посчитайте свою экономию
            </h2>
            <p className="mt-2 text-brand-100">
              Нужны три цифры из квитанции за последний месяц.
            </p>
          </div>

          <div className="[&_a:first-child]:bg-white [&_a:first-child]:text-brand-800 [&_a:first-child]:hover:bg-brand-50 [&_a:last-child]:border-brand-400 [&_a:last-child]:text-white [&_a:last-child]:hover:border-brand-200">
            <CtaButtons size="small" />
          </div>
        </div>
      </section>

      <footer className="mx-auto w-full max-w-5xl px-4 py-8 text-sm text-muted sm:px-6">
        EcoFin — прототип, созданный для хакатона. Региональные нормы и тарифы
        основаны на открытых данных и экспертных оценках.
      </footer>
    </main>
  );
}
