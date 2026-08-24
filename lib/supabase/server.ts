import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Клиент Supabase для серверного кода.
 *
 * Создаётся на каждый запрос, а не переиспользуется модулем: в серверлесс
 * инстанс живёт между вызовами, и общий клиент потащил бы состояние одного
 * запроса в другой.
 *
 * @throws Error, если переменные окружения не заданы — вызывающий route handler
 *         обязан поймать это и вернуть 500, а не уронить запрос без ответа.
 */
export function createSupabaseServerClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Не заданы NEXT_PUBLIC_SUPABASE_URL и NEXT_PUBLIC_SUPABASE_ANON_KEY на сервере. " +
        "Проверьте .env.local локально и переменные окружения в настройках деплоя.",
    );
  }

  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        "x-application-name": "ecofin",
      },
    },
  });
}
