const PREFIX = "furevrnac:";

export interface Save {
  get<T>(key: string, fallback: T): T;
  set<T>(key: string, value: T): void;
}

export function createSave(storage: Storage): Save {
  return {
    get<T>(key: string, fallback: T): T {
      try {
        const raw = storage.getItem(PREFIX + key);
        return raw === null ? fallback : (JSON.parse(raw) as T);
      } catch {
        return fallback;
      }
    },
    set<T>(key: string, value: T): void {
      try {
        storage.setItem(PREFIX + key, JSON.stringify(value));
      } catch {
        /* storage unavailable — play session-only */
      }
    },
  };
}
