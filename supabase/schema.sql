-- ============================================================================
-- EcoFin — схема базы данных (Supabase / PostgreSQL)
-- ============================================================================
-- Накатывается целиком через SQL Editor в Supabase.
-- Скрипт идемпотентный: повторный прогон не ломает существующие данные.
--
-- ВНИМАНИЕ (демо-режим): в MVP нет аутентификации. Профиль хранится в
-- localStorage браузера. RLS включён, но политики разрешают доступ роли anon.
-- Перед продакшеном заменить на политики, привязанные к auth.uid().
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Справочные значения (используются в CHECK-констрейнтах и в lib/types.ts)
--   object_type   : household | school | business
--   resource_type : electricity | water | waste
--   status        : pending | applied | dismissed
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- profiles — объект, который экономит ресурсы (дом, школа, бизнес)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key default gen_random_uuid(),
  object_type text        not null check (object_type in ('household', 'school', 'business')),
  name        text        not null check (length(trim(name)) > 0),
  region      text        not null check (length(trim(region)) > 0),
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- regional_benchmarks — средние показатели потребления по региону и типу объекта.
-- Используются AI-модулем как база для сравнения и дашбордом для графика.
-- tariff_per_unit дублирует lib/tariffs.ts: константы в коде — источник правды
-- для расчёта денег, здесь значение хранится для справки и будущей регионализации.
-- ---------------------------------------------------------------------------
create table if not exists public.regional_benchmarks (
  id              uuid primary key default gen_random_uuid(),
  region          text           not null,
  object_type     text           not null check (object_type in ('household', 'school', 'business')),
  resource_type   text           not null check (resource_type in ('electricity', 'water', 'waste')),
  avg_value       numeric(12, 2) not null check (avg_value >= 0),
  unit            text           not null,
  tariff_per_unit numeric(12, 2) not null check (tariff_per_unit >= 0),
  source          text,
  created_at      timestamptz    not null default now(),
  constraint regional_benchmarks_unique unique (region, object_type, resource_type)
);

-- ---------------------------------------------------------------------------
-- resource_baselines — текущее потребление профиля, введённое в онбординге
-- ---------------------------------------------------------------------------
create table if not exists public.resource_baselines (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid           not null references public.profiles (id) on delete cascade,
  resource_type text           not null check (resource_type in ('electricity', 'water', 'waste')),
  value         numeric(12, 2) not null check (value >= 0),
  unit          text           not null,
  created_at    timestamptz    not null default now(),
  constraint resource_baselines_unique unique (profile_id, resource_type)
);

-- ---------------------------------------------------------------------------
-- consumption_logs — история показаний по месяцам (задел под динамику)
-- ---------------------------------------------------------------------------
create table if not exists public.consumption_logs (
  id            uuid           primary key default gen_random_uuid(),
  profile_id    uuid           not null references public.profiles (id) on delete cascade,
  resource_type text           not null check (resource_type in ('electricity', 'water', 'waste')),
  value         numeric(12, 2) not null check (value >= 0),
  unit          text           not null,
  period        date           not null,
  created_at    timestamptz    not null default now(),
  constraint consumption_logs_unique unique (profile_id, resource_type, period)
);

-- ---------------------------------------------------------------------------
-- ai_recommendations — результат работы AI-модуля.
-- estimated_savings_tenge считается на нашей стороне (lib/tariffs.ts),
-- модели расчёт денег не доверяем.
-- ---------------------------------------------------------------------------
create table if not exists public.ai_recommendations (
  id                         uuid           primary key default gen_random_uuid(),
  profile_id                 uuid           not null references public.profiles (id) on delete cascade,
  resource_type              text           not null check (resource_type in ('electricity', 'water', 'waste')),
  recommendation_text        text           not null,
  estimated_savings_resource numeric(12, 2) not null default 0 check (estimated_savings_resource >= 0),
  resource_unit              text           not null,
  estimated_savings_tenge    numeric(12, 2) not null default 0 check (estimated_savings_tenge >= 0),
  reasoning                  text,
  status                     text           not null default 'pending'
                                            check (status in ('pending', 'applied', 'dismissed')),
  generated_at               timestamptz    not null default now()
);

-- ---------------------------------------------------------------------------
-- org_units — подразделения организации (классы школы, отделы компании).
-- Только для профилей с object_type 'school' или 'business'.
-- ---------------------------------------------------------------------------
create table if not exists public.org_units (
  id             uuid           primary key default gen_random_uuid(),
  profile_id     uuid           not null references public.profiles (id) on delete cascade,
  unit_name      text           not null check (length(trim(unit_name)) > 0),
  resource_type  text           not null check (resource_type in ('electricity', 'water', 'waste')),
  baseline_value numeric(12, 2) not null check (baseline_value >= 0),
  unit           text           not null,
  created_at     timestamptz    not null default now()
);

-- ---------------------------------------------------------------------------
-- Индексы под запросы приложения
-- ---------------------------------------------------------------------------
create index if not exists resource_baselines_profile_idx on public.resource_baselines (profile_id);
create index if not exists consumption_logs_profile_idx   on public.consumption_logs (profile_id, period desc);
create index if not exists ai_recommendations_profile_idx on public.ai_recommendations (profile_id, generated_at desc);
create index if not exists org_units_profile_idx          on public.org_units (profile_id);
create index if not exists regional_benchmarks_lookup_idx on public.regional_benchmarks (region, object_type);

-- ---------------------------------------------------------------------------
-- RLS — ДЕМО-ПОЛИТИКИ. Открытый доступ, потому что аутентификации в MVP нет.
-- ---------------------------------------------------------------------------
alter table public.profiles            enable row level security;
alter table public.regional_benchmarks enable row level security;
alter table public.resource_baselines  enable row level security;
alter table public.consumption_logs    enable row level security;
alter table public.ai_recommendations  enable row level security;
alter table public.org_units           enable row level security;

drop policy if exists demo_all_profiles            on public.profiles;
drop policy if exists demo_all_regional_benchmarks on public.regional_benchmarks;
drop policy if exists demo_all_resource_baselines  on public.resource_baselines;
drop policy if exists demo_all_consumption_logs    on public.consumption_logs;
drop policy if exists demo_all_ai_recommendations  on public.ai_recommendations;
drop policy if exists demo_all_org_units           on public.org_units;

create policy demo_all_profiles            on public.profiles            for all to anon, authenticated using (true) with check (true);
create policy demo_all_regional_benchmarks on public.regional_benchmarks for all to anon, authenticated using (true) with check (true);
create policy demo_all_resource_baselines  on public.resource_baselines  for all to anon, authenticated using (true) with check (true);
create policy demo_all_consumption_logs    on public.consumption_logs    for all to anon, authenticated using (true) with check (true);
create policy demo_all_ai_recommendations  on public.ai_recommendations  for all to anon, authenticated using (true) with check (true);
create policy demo_all_org_units           on public.org_units           for all to anon, authenticated using (true) with check (true);

-- ---------------------------------------------------------------------------
-- create_profile_with_baselines — создание профиля и его потребления одной
-- транзакцией.
--
-- Через PostgREST два отдельных insert выполнились бы независимо: упавший
-- второй оставил бы профиль без единого показателя, и AI-модулю нечего было бы
-- анализировать. Тело plpgsql-функции — одна транзакция, любая ошибка
-- откатывает всё.
--
-- security invoker (по умолчанию): функция исполняется с правами вызывающего,
-- RLS применяется как обычно.
--
-- p_baselines — jsonb-массив вида
--   [{"resource_type": "electricity", "value": 320, "unit": "кВт·ч/мес"}, ...]
-- Единицы измерения проставляет сервер из lib/tariffs.ts, а не клиент.
-- ---------------------------------------------------------------------------
create or replace function public.create_profile_with_baselines(
  p_object_type text,
  p_name        text,
  p_region      text,
  p_baselines   jsonb
)
returns public.profiles
language plpgsql
as $$
declare
  v_profile public.profiles;
begin
  insert into public.profiles (object_type, name, region)
  values (p_object_type, trim(p_name), trim(p_region))
  returning * into v_profile;

  insert into public.resource_baselines (profile_id, resource_type, value, unit)
  select
    v_profile.id,
    item ->> 'resource_type',
    (item ->> 'value')::numeric,
    item ->> 'unit'
  from jsonb_array_elements(coalesce(p_baselines, '[]'::jsonb)) as item;

  return v_profile;
end;
$$;

grant execute on function public.create_profile_with_baselines(text, text, text, jsonb)
  to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Сид: региональные бенчмарки
-- ---------------------------------------------------------------------------
-- ИСТОЧНИК ДАННЫХ: значения ПРИМЕРНЫЕ — экспертная оценка на основе открытых
-- данных Бюро нацстатистики РК по среднему потреблению домохозяйств и типовых
-- нормативов для бюджетных учреждений. Перед сдачей заменить на выверенные
-- цифры и указать ссылку на источник в README.
--
-- ТАРИФЫ (тг за единицу) — прикидка, актуализировать по Уральску:
--   электричество 25 тг/кВт·ч, вода 180 тг/м³, вывоз отходов 12 тг/кг.
-- Тот же набор значений продублирован в lib/tariffs.ts — менять в обоих местах.
--
-- Регион '__default__' — fallback, когда под регион профиля бенчмарка нет.
-- ---------------------------------------------------------------------------
insert into public.regional_benchmarks
  (region, object_type, resource_type, avg_value, unit, tariff_per_unit, source)
values
  -- fallback по стране
  ('__default__', 'household', 'electricity',  250.00, 'кВт·ч/мес',  25.00, 'Оценка на основе открытых данных БНС РК'),
  ('__default__', 'household', 'water',          9.00, 'м³/мес',    180.00, 'Оценка на основе открытых данных БНС РК'),
  ('__default__', 'household', 'waste',         90.00, 'кг/мес',     12.00, 'Оценка на основе открытых данных БНС РК'),
  ('__default__', 'school',    'electricity', 4500.00, 'кВт·ч/мес',  25.00, 'Экспертная оценка: типовая школа на 500 учащихся'),
  ('__default__', 'school',    'water',        120.00, 'м³/мес',    180.00, 'Экспертная оценка: типовая школа на 500 учащихся'),
  ('__default__', 'school',    'waste',        800.00, 'кг/мес',     12.00, 'Экспертная оценка: типовая школа на 500 учащихся'),
  ('__default__', 'business',  'electricity', 1800.00, 'кВт·ч/мес',  25.00, 'Экспертная оценка: малый офис или точка до 30 сотрудников'),
  ('__default__', 'business',  'water',         45.00, 'м³/мес',    180.00, 'Экспертная оценка: малый офис или точка до 30 сотрудников'),
  ('__default__', 'business',  'waste',        350.00, 'кг/мес',     12.00, 'Экспертная оценка: малый офис или точка до 30 сотрудников'),

  -- Западно-Казахстанская область (Уральск) — целевой регион демо
  ('Западно-Казахстанская область', 'household', 'electricity',  270.00, 'кВт·ч/мес',  25.00, 'Оценка: холодные зимы, высокая доля электроотопления'),
  ('Западно-Казахстанская область', 'household', 'water',          8.50, 'м³/мес',    180.00, 'Оценка на основе открытых данных БНС РК'),
  ('Западно-Казахстанская область', 'household', 'waste',         85.00, 'кг/мес',     12.00, 'Оценка на основе открытых данных БНС РК'),
  ('Западно-Казахстанская область', 'school',    'electricity', 4800.00, 'кВт·ч/мес',  25.00, 'Экспертная оценка: типовая школа на 500 учащихся'),
  ('Западно-Казахстанская область', 'school',    'water',        115.00, 'м³/мес',    180.00, 'Экспертная оценка: типовая школа на 500 учащихся'),
  ('Западно-Казахстанская область', 'school',    'waste',        780.00, 'кг/мес',     12.00, 'Экспертная оценка: типовая школа на 500 учащихся'),
  ('Западно-Казахстанская область', 'business',  'electricity', 1900.00, 'кВт·ч/мес',  25.00, 'Экспертная оценка: малый офис или точка до 30 сотрудников'),
  ('Западно-Казахстанская область', 'business',  'water',         42.00, 'м³/мес',    180.00, 'Экспертная оценка: малый офис или точка до 30 сотрудников'),
  ('Западно-Казахстанская область', 'business',  'waste',        340.00, 'кг/мес',     12.00, 'Экспертная оценка: малый офис или точка до 30 сотрудников'),

  -- Астана
  ('Астана', 'household', 'electricity',  260.00, 'кВт·ч/мес',  25.00, 'Оценка на основе открытых данных БНС РК'),
  ('Астана', 'household', 'water',          9.50, 'м³/мес',    180.00, 'Оценка на основе открытых данных БНС РК'),
  ('Астана', 'household', 'waste',         95.00, 'кг/мес',     12.00, 'Оценка на основе открытых данных БНС РК'),
  ('Астана', 'school',    'electricity', 5000.00, 'кВт·ч/мес',  25.00, 'Экспертная оценка: типовая школа на 500 учащихся'),
  ('Астана', 'school',    'water',        130.00, 'м³/мес',    180.00, 'Экспертная оценка: типовая школа на 500 учащихся'),
  ('Астана', 'school',    'waste',        850.00, 'кг/мес',     12.00, 'Экспертная оценка: типовая школа на 500 учащихся'),
  ('Астана', 'business',  'electricity', 2000.00, 'кВт·ч/мес',  25.00, 'Экспертная оценка: малый офис или точка до 30 сотрудников'),
  ('Астана', 'business',  'water',         48.00, 'м³/мес',    180.00, 'Экспертная оценка: малый офис или точка до 30 сотрудников'),
  ('Астана', 'business',  'waste',        380.00, 'кг/мес',     12.00, 'Экспертная оценка: малый офис или точка до 30 сотрудников'),

  -- Алматы
  ('Алматы', 'household', 'electricity',  230.00, 'кВт·ч/мес',  25.00, 'Оценка на основе открытых данных БНС РК'),
  ('Алматы', 'household', 'water',         10.50, 'м³/мес',    180.00, 'Оценка на основе открытых данных БНС РК'),
  ('Алматы', 'household', 'waste',        100.00, 'кг/мес',     12.00, 'Оценка на основе открытых данных БНС РК'),
  ('Алматы', 'school',    'electricity', 4300.00, 'кВт·ч/мес',  25.00, 'Экспертная оценка: типовая школа на 500 учащихся'),
  ('Алматы', 'school',    'water',        140.00, 'м³/мес',    180.00, 'Экспертная оценка: типовая школа на 500 учащихся'),
  ('Алматы', 'school',    'waste',        900.00, 'кг/мес',     12.00, 'Экспертная оценка: типовая школа на 500 учащихся'),
  ('Алматы', 'business',  'electricity', 1750.00, 'кВт·ч/мес',  25.00, 'Экспертная оценка: малый офис или точка до 30 сотрудников'),
  ('Алматы', 'business',  'water',         52.00, 'м³/мес',    180.00, 'Экспертная оценка: малый офис или точка до 30 сотрудников'),
  ('Алматы', 'business',  'waste',        400.00, 'кг/мес',     12.00, 'Экспертная оценка: малый офис или точка до 30 сотрудников'),

  -- Шымкент
  ('Шымкент', 'household', 'electricity',  240.00, 'кВт·ч/мес',  25.00, 'Оценка на основе открытых данных БНС РК'),
  ('Шымкент', 'household', 'water',         11.00, 'м³/мес',    180.00, 'Оценка: жаркий климат, повышенный расход на полив'),
  ('Шымкент', 'household', 'waste',         92.00, 'кг/мес',     12.00, 'Оценка на основе открытых данных БНС РК'),
  ('Шымкент', 'school',    'electricity', 4400.00, 'кВт·ч/мес',  25.00, 'Экспертная оценка: типовая школа на 500 учащихся'),
  ('Шымкент', 'school',    'water',        145.00, 'м³/мес',    180.00, 'Экспертная оценка: типовая школа на 500 учащихся'),
  ('Шымкент', 'school',    'waste',        820.00, 'кг/мес',     12.00, 'Экспертная оценка: типовая школа на 500 учащихся'),
  ('Шымкент', 'business',  'electricity', 1800.00, 'кВт·ч/мес',  25.00, 'Экспертная оценка: малый офис или точка до 30 сотрудников'),
  ('Шымкент', 'business',  'water',         55.00, 'м³/мес',    180.00, 'Экспертная оценка: малый офис или точка до 30 сотрудников'),
  ('Шымкент', 'business',  'waste',        370.00, 'кг/мес',     12.00, 'Экспертная оценка: малый офис или точка до 30 сотрудников')
on conflict (region, object_type, resource_type) do update
  set avg_value       = excluded.avg_value,
      unit            = excluded.unit,
      tariff_per_unit = excluded.tariff_per_unit,
      source          = excluded.source;
