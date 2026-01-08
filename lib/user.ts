const STORAGE_KEY = "polymarket-sim-user";

interface StoredUserData {
  id: string;
}

/**
 * Získa alebo vytvorí lokálne user ID v localStorage.
 * Pre server-side rendering vráti fallback hodnotu.
 */
export function getOrCreateUserId(): string {
  if (typeof window === "undefined") {
    return "server-user";
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed: StoredUserData = JSON.parse(stored);
      if (parsed?.id) {
        return parsed.id;
      }
    }
  } catch (error) {
    console.warn("Failed to read localStorage", error);
  }

  const newId = crypto.randomUUID();
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ id: newId }));
  } catch (error) {
    console.warn("Failed to persist user id", error);
  }

  return newId;
}
