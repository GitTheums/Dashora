import { EventEmitter } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";
import { registerGracefulShutdown } from "./graceful-shutdown.js";

type FakeApp = {
  log: { info: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  close: ReturnType<typeof vi.fn>;
};

function createFakeApp(closeImpl?: () => Promise<void>): FakeApp {
  return {
    log: {
      info: vi.fn(),
      error: vi.fn(),
    },
    close: vi.fn(closeImpl ?? (async () => undefined)),
  };
}

describe("registerGracefulShutdown", () => {
  const disposers: Array<() => void> = [];

  afterEach(() => {
    for (const dispose of disposers.splice(0)) {
      dispose();
    }
  });

  it("closes the app and exits 0 on SIGTERM", async () => {
    const app = createFakeApp();
    const processRef = new EventEmitter() as EventEmitter & NodeJS.Process;
    const exit = vi.fn();

    disposers.push(
      registerGracefulShutdown(app as never, {
        processRef,
        exit,
        signals: ["SIGTERM"],
      }),
    );

    processRef.emit("SIGTERM", "SIGTERM");
    await vi.waitFor(() => {
      expect(exit).toHaveBeenCalledWith(0);
    });
    expect(app.close).toHaveBeenCalledOnce();
    expect(app.log.info).toHaveBeenCalledWith({ signal: "SIGTERM" }, "Shutting down gracefully");
  });

  it("ignores a second signal while shutdown is in progress", async () => {
    let resolveClose: (() => void) | undefined;
    const app = createFakeApp(
      () =>
        new Promise<void>((resolve) => {
          resolveClose = resolve;
        }),
    );
    const processRef = new EventEmitter() as EventEmitter & NodeJS.Process;
    const exit = vi.fn();

    disposers.push(
      registerGracefulShutdown(app as never, {
        processRef,
        exit,
        signals: ["SIGTERM", "SIGINT"],
      }),
    );

    processRef.emit("SIGTERM", "SIGTERM");
    processRef.emit("SIGINT", "SIGINT");
    expect(app.close).toHaveBeenCalledOnce();

    resolveClose?.();
    await vi.waitFor(() => {
      expect(exit).toHaveBeenCalledWith(0);
    });
  });

  it("exits 1 when close fails", async () => {
    const failure = new Error("close failed");
    const app = createFakeApp(async () => {
      throw failure;
    });
    const processRef = new EventEmitter() as EventEmitter & NodeJS.Process;
    const exit = vi.fn();

    disposers.push(
      registerGracefulShutdown(app as never, {
        processRef,
        exit,
        signals: ["SIGTERM"],
      }),
    );

    processRef.emit("SIGTERM", "SIGTERM");
    await vi.waitFor(() => {
      expect(exit).toHaveBeenCalledWith(1);
    });
    expect(app.log.error).toHaveBeenCalledWith(failure, "Error during graceful shutdown");
  });
});
