import { beforeEach } from "vitest";

/**
 * Node 26+ exposes experimental `globalThis.localStorage` that warns without
 * `--localstorage-file`. Install an in-memory Storage without reading Node's getter.
 */
function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key) {
      return store.has(key) ? (store.get(key) ?? null) : null;
    },
    key(index) {
      return [...store.keys()][index] ?? null;
    },
    removeItem(key) {
      store.delete(key);
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
  };
}

function installTestLocalStorage(): void {
  if (typeof window === "undefined") {
    return;
  }
  const storage = createMemoryStorage();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    enumerable: true,
    value: storage,
  });
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    enumerable: true,
    value: storage,
  });
}

installTestLocalStorage();

beforeEach(() => {
  if (typeof window !== "undefined" && window.localStorage) {
    window.localStorage.clear();
  }
});
