"use client";

import { useSyncExternalStore } from "react";

import { getProfileId, subscribeToProfileChange } from "./profile";

// Хук вынесен из lib/profile.ts, потому что тот импортируют серверные route
// handlers: клиентский React в серверном бандле ломает сборку.

function getServerProfileId(): null {
  return null;
}

/**
 * id текущего профиля; null во время SSR и до гидратации.
 *
 * useSyncExternalStore, а не useState с эффектом: React сам разводит серверный
 * и клиентский снапшот и переподписывается при смене профиля в соседней вкладке.
 */
export function useProfileId(): string | null {
  return useSyncExternalStore(
    subscribeToProfileChange,
    getProfileId,
    getServerProfileId,
  );
}
