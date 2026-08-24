import { notFound } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isValidProfileId } from "@/lib/profile";

/**
 * Проверка существования профиля живёт здесь, а не в самой странице.
 *
 * Из-за loading.tsx страница обёрнута в Suspense: Next отдаёт оболочку сразу,
 * со статусом 200, и notFound() внутри страницы уже не может его изменить —
 * пользователь видел бы «не найдено» с успешным HTTP-кодом. Layout рендерится
 * до Suspense-границы, поэтому здесь 404 честный. Ценой запроса `select id`.
 */
export default async function DashboardLayout({
  children,
  params,
}: LayoutProps<"/dashboard/[profileId]">) {
  const { profileId } = await params;

  if (!isValidProfileId(profileId)) {
    notFound();
  }

  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", profileId)
    .maybeSingle<{ id: string }>();

  if (error) {
    console.error("[dashboard] Проверка профиля не удалась:", error);
    throw new Error("Не удалось проверить профиль");
  }

  if (!data) {
    notFound();
  }

  return children;
}
