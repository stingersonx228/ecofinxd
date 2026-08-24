@AGENTS.md

# EcoFin

AI-платформа ресурсоэффективности для Казахстана: пользователь вводит текущее
потребление (электричество, вода, отходы), система сравнивает его с региональным
бенчмарком и через Claude генерирует конкретные рекомендации с расчётом экономии
в тенге. Аудитории: домохозяйства, школы, малый бизнес.

Хакатонный MVP. Приоритет — работающий сквозной путь, а не полнота функционала.

## Стек

- Next.js 16 (App Router), React 19, TypeScript strict
- Tailwind CSS v4 (без `tailwind.config.js`, темизация через `@theme` в `app/globals.css`)
- Supabase (PostgreSQL) через `@supabase/supabase-js`
- Anthropic SDK (`@anthropic-ai/sdk`), модель `claude-sonnet-5`
- recharts для графиков
- Деплой: Vercel

## Структура

```
app/
  page.tsx                       лендинг
  onboarding/page.tsx            ввод профиля и текущего потребления
  dashboard/[profileId]/layout.tsx     проверка существования профиля до Suspense
  dashboard/[profileId]/(overview)/    личный кабинет + его скелетон
  dashboard/[profileId]/org/           панель организации (school | business)
  not-found.tsx                        глобальная 404
  api/profiles/route.ts          создание и чтение профиля
  api/recommendations/route.ts   генерация, чтение, смена статуса рекомендаций
  api/org-units/route.ts         подразделения организации
components/
  dashboard/consumption-chart.tsx      график recharts (клиентский)
  dashboard/recommendations-panel.tsx  список рекомендаций (клиентский)
  dashboard/org-unit-form.tsx          форма подразделения (клиентский)
lib/
  dashboard.ts                   сбор данных кабинета и сравнение с нормой
  supabase/client.ts             клиент для клиентских компонентов
  supabase/server.ts             клиент для route handlers
  types.ts                       типы, зеркалящие схему БД
  tariffs.ts                     тарифы и calculateSavingsTenge()
  regions.ts                     список регионов РК для формы
  profile.ts                     demo-профиль в localStorage (без React)
  use-profile-id.ts              хук useProfileId() поверх lib/profile.ts
  ai/recommendations.ts          вызов Claude и парсинг ответа
supabase/schema.sql              схема БД, накатывается через SQL Editor
```

## Поток данных

1. Онбординг → `POST /api/profiles` → строки в `profiles` + `resource_baselines`,
   `profile_id` кладётся в localStorage.
2. Дашборд → `POST /api/recommendations` → сервер читает профиль, baselines и
   `regional_benchmarks` под регион → `generateRecommendations()` → Claude →
   валидация JSON → запись в `ai_recommendations` → рендер.
3. Кнопки «Применил» / «Не подходит» → `PATCH /api/recommendations` → `status`.

## Модель данных

Таблицы: `profiles`, `regional_benchmarks`, `resource_baselines`,
`consumption_logs`, `ai_recommendations`, `org_units`. Единственный источник
правды — `supabase/schema.sql`; типы в `lib/types.ts` обязаны ему соответствовать.

Union-типы:
- `ObjectType` = `'household' | 'school' | 'business'`
- `ResourceType` = `'electricity' | 'water' | 'waste'`
- статус рекомендации = `'pending' | 'applied' | 'dismissed'`

## Правила, которые нельзя нарушать

- **Никаких заглушек.** Каждая функция реализована полностью, с обработкой ошибок.
  Не оставлять `TODO`, пустые обработчики, «заполнить позже».
- **Деньги считаем сами.** `estimated_savings_tenge` вычисляется через
  `lib/tariffs.ts`. Числа в тенге, пришедшие от модели, игнорируются.
- **Ответ модели — недоверенные данные.** Снять markdown-фенсы, `JSON.parse` в
  `try/catch`, провалидировать каждый элемент. Невалидный элемент отбрасывается,
  весь ответ при этом не рушится.
- **`ANTHROPIC_API_KEY` только на сервере.** Ни в клиентском компоненте, ни в
  переменной с префиксом `NEXT_PUBLIC_`.
- **Ошибки клиента — 400 с внятным сообщением**, а не 500. Валидация входа во
  всех route handlers: тип объекта из списка, значения `>= 0`, строки непустые.
- **Все состояния UI обработаны**: загрузка, пустой результат, ошибка с
  возможностью повтора. Введённые пользователем данные при ошибке не теряются.

## Next.js 16 — что отличается

- `params` и `searchParams` асинхронные: `const { profileId } = await params`.
  В клиентском компоненте — через `use(params)`.
- Типы пропсов страниц и лейаутов генерируются: `PageProps<'/dashboard/[profileId]'>`,
  `LayoutProps<'/'>`. Использовать их вместо ручных интерфейсов.
- Route handlers — `export async function GET/POST/PATCH(request: Request)`.
- Точная сверка API — в `node_modules/next/dist/docs/`, не по памяти.

## UI

- Язык интерфейса — русский. Единицы: кВт·ч/мес, м³/мес, кг/мес, тенге («тг»).
- Палитра тёмно-зелёная, токены в `app/globals.css` (`--color-brand-*`).
  Не вводить новые цвета мимо токенов.
- Минимализм, mobile-friendly сетка. Анимации — по минимуму, важна
  работоспособность.
- Главный визуальный акцент дашборда — суммарная экономия в тенге/мес.

## Переменные окружения

`.env.local` (в git не попадает), шаблон — `.env.example`:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
ANTHROPIC_API_KEY=
```

## Проверка перед коммитом

```bash
npm run build
```

Сборка обязана проходить без ошибок типов и линта. Не начинать следующий шаг на
сломанной сборке.

## Что заведомо на примерных данных

Региональные бенчмарки и тарифы (25 тг/кВт·ч, 180 тг/м³, 12 тг/кг) — оценки, а не
выверенные цифры. Это честно указано в README и в комментариях к
`supabase/schema.sql` и `lib/tariffs.ts`. При замене на реальные значения править
оба места.
