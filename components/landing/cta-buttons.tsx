"use client";

/**
 * Кнопки призыва к действию на лендинге.
 *
 * Клиентский компонент, потому что «Мой кабинет» зависит от localStorage.
 * До гидратации кнопки нет — на сервере профиль неизвестен, и подставлять
 * ссылку наугад нельзя. «Начать» отрисована сразу и работает всегда.
 */

import Link from "next/link";

import { useProfileId } from "@/lib/use-profile-id";

export function CtaButtons({ size = "large" }: { size?: "large" | "small" }) {
  const profileId = useProfileId();

  const primary =
    size === "large"
      ? "rounded-lg bg-brand-600 px-7 py-3.5 text-base font-medium text-white transition-colors hover:bg-brand-700"
      : "rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-700";

  const secondary =
    size === "large"
      ? "rounded-lg border border-border px-7 py-3.5 text-base font-medium transition-colors hover:border-brand-300"
      : "rounded-lg border border-border px-5 py-2.5 text-sm font-medium transition-colors hover:border-brand-300";

  return (
    <div className="flex flex-wrap gap-3">
      <Link href="/onboarding" className={primary}>
        Начать
      </Link>

      {profileId ? (
        <Link href={`/dashboard/${profileId}`} className={secondary}>
          Мой кабинет
        </Link>
      ) : null}
    </div>
  );
}
