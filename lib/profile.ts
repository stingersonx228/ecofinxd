/**
 * Demo-профиль: какой объект открыт в этом браузере. Аутентификации нет,
 * поэтому «кто я» сводится к uuid в localStorage.
 *
 * Все функции безопасны на сервере (во время SSR `window` не существует) и при
 * недоступном хранилище: localStorage бросает исключение в приватном режиме
 * Safari, а ронять из-за этого страницу нельзя.
 */

const STORAGE_KEY = "ecofin.profile_id";

const CHANGE_EVENT = "ecofin:profile-changed";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * В localStorage может лежать что угодно — мусор от прошлой версии, ручная
 * правка в devtools. Такое значение нельзя подставлять в URL и в запросы к БД.
 */
export function isValidProfileId(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value.trim());
}

/** null означает «профиля нет»: SSR, пустое хранилище, битое значение. */
export function getProfileId(): string | null {
  const storage = getStorage();

  if (!storage) {
    return null;
  }

  try {
    const raw = storage.getItem(STORAGE_KEY);

    if (!isValidProfileId(raw)) {
      // Битое значение чистим, чтобы не спотыкаться о него каждый рендер.
      if (raw !== null) {
        storage.removeItem(STORAGE_KEY);
      }
      return null;
    }

    return raw.trim();
  } catch {
    return null;
  }
}

/**
 * @returns false, если id невалиден или хранилище недоступно. Онбординг по
 *          false не должен блокировать переход: id всё равно есть в URL.
 */
export function setProfileId(id: string): boolean {
  if (!isValidProfileId(id)) {
    return false;
  }

  const storage = getStorage();

  if (!storage) {
    return false;
  }

  try {
    storage.setItem(STORAGE_KEY, id.trim());
    notifyChange();
    return true;
  } catch {
    return false;
  }
}

/** Удаляет профиль из хранилища — «выйти» и начать онбординг заново. */
export function clearProfileId(): void {
  const storage = getStorage();

  if (!storage) {
    return;
  }

  try {
    storage.removeItem(STORAGE_KEY);
    notifyChange();
  } catch {
    // Хранилище недоступно — значит и значения там нет.
  }
}

export function hasProfile(): boolean {
  return getProfileId() !== null;
}

function notifyChange(): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    // Старые браузеры без конструктора Event.
  }
}

/** Смена профиля в этой вкладке (CHANGE_EVENT) и в соседних (`storage`). */
export function subscribeToProfileChange(listener: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === STORAGE_KEY) {
      listener();
    }
  };

  window.addEventListener(CHANGE_EVENT, listener);
  window.addEventListener("storage", onStorage);

  return () => {
    window.removeEventListener(CHANGE_EVENT, listener);
    window.removeEventListener("storage", onStorage);
  };
}
