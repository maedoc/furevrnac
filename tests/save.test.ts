import { describe, it, expect } from "vitest";
import { createSave } from "../src/engine/save";

function memoryStorage(): Storage {
  const mem = new Map<string, string>();
  return {
    get length() {
      return mem.size;
    },
    clear: () => mem.clear(),
    getItem: (k) => mem.get(k) ?? null,
    key: (i) => [...mem.keys()][i] ?? null,
    removeItem: (k) => void mem.delete(k),
    setItem: (k, v) => void mem.set(k, String(v)),
  } as Storage;
}

describe("save", () => {
  it("stores and retrieves values with the app prefix", () => {
    const storage = memoryStorage();
    const save = createSave(storage);
    save.set("snake:best", 12);
    expect(save.get("snake:best", 0)).toBe(12);
    expect(storage.getItem("furevrnac:snake:best")).not.toBeNull();
  });

  it("returns fallback for missing keys", () => {
    const save = createSave(memoryStorage());
    expect(save.get("nothing", "fallback")).toBe("fallback");
  });

  it("survives corrupt JSON", () => {
    const storage = memoryStorage();
    storage.setItem("furevrnac:bad", "{not json");
    const save = createSave(storage);
    expect(save.get("bad", 42)).toBe(42);
  });
});
