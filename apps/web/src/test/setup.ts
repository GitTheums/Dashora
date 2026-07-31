import { beforeEach } from "vitest";

class ResizeObserverStub {
  private readonly callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }

  observe(target: Element): void {
    const width =
      target instanceof HTMLElement && target.clientWidth > 0 ? target.clientWidth : 1280;
    const entry = {
      target,
      contentRect: {
        x: 0,
        y: 0,
        width,
        height: target instanceof HTMLElement ? target.clientHeight : 0,
        top: 0,
        left: 0,
        bottom: 0,
        right: width,
        toJSON() {
          return this;
        },
      },
      borderBoxSize: [],
      contentBoxSize: [],
      devicePixelContentBoxSize: [],
    } as unknown as ResizeObserverEntry;
    this.callback([entry], this as unknown as ResizeObserver);
  }

  unobserve(): void {}

  disconnect(): void {}
}

if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
}

/**
 * Node 26+ exposes an experimental `globalThis.localStorage` that emits
 * `ExperimentalWarning` when read without `--localstorage-file`. Replace it with a
 * standards-compatible in-memory Storage on both `window` and `globalThis` without ever
 * touching Node's getter.
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

if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
}
